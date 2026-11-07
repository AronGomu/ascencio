use crate::native_io_trace::{self, Category, Operation};
use crate::{content_folder, manifest_is_valid, verified_file, ReleaseManifest, ReleasePackage};
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::Path;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StorageFailure {
    code: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    package_id: Option<String>,
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub(crate) enum Outcome<T: Serialize> {
    Ok { value: T },
    Failed { error: StorageFailure },
}

fn failed<T: Serialize>(code: &'static str, package_id: Option<&str>) -> Outcome<T> {
    Outcome::Failed {
        error: StorageFailure {
            code,
            package_id: package_id.map(str::to_owned),
        },
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PackageStack {
    generation: u64,
    packages: Vec<Value>,
}

pub(crate) fn installed(handle: &tauri::AppHandle) -> Result<ReleaseManifest, String> {
    let path = content_folder(handle)?.join("active.json");
    if !path.exists() {
        crate::seed_content(handle)?;
    }
    let manifest: ReleaseManifest = serde_json::from_slice(
        &native_io_trace::read(&path, Category::Registry, "active-manifest")
            .map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    if !manifest_is_valid(&manifest) {
        return Err("Installed content manifest is invalid".into());
    }
    Ok(manifest)
}

pub(crate) fn package_path(folder: &Path, package: &ReleasePackage) -> std::path::PathBuf {
    folder.join(format!("{}-{}.sqlite", package.package_id, package.version))
}

pub(crate) fn open_package(path: &Path) -> Result<Connection, String> {
    open_package_category(path, Category::Registry)
}

fn open_package_category(path: &Path, category: Category) -> Result<Connection, String> {
    let _open = native_io_trace::start(category, Operation::SqliteOpen, "package-open");
    let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|error| error.to_string())?;
    connection
        .execute_batch("PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;")
        .map_err(|error| error.to_string())?;
    Ok(connection)
}

pub(crate) fn package_header(connection: &Connection) -> Result<Value, String> {
    connection
        .query_row(
            "SELECT package_id,package_type,version,schema_version,dependencies_json,created_at FROM package_manifest",
            [],
            |row| {
                let dependencies: String = row.get(4)?;
                let parsed = serde_json::from_str::<Value>(&dependencies).unwrap_or(Value::Null);
                Ok(json!({
                    "packageId": row.get::<_, String>(0)?,
                    "packageType": row.get::<_, String>(1)?,
                    "version": row.get::<_, String>(2)?,
                    "schemaVersion": row.get::<_, i64>(3)?,
                    "dependencies": parsed,
                    "createdAt": row.get::<_, String>(5)?,
                }))
            },
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn native_package_stack(
    handle: tauri::AppHandle,
    verify: bool,
) -> Outcome<PackageStack> {
    let _command = native_io_trace::start(
        Category::Registry,
        Operation::Command,
        "native_package_stack",
    );
    let manifest = match installed(&handle) {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE", None),
    };
    let folder = match content_folder(&handle) {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE", None),
    };
    let mut packages = Vec::with_capacity(manifest.packages.len());
    for package in &manifest.packages {
        let path = package_path(&folder, package);
        if verify && !matches!(verified_file(&path, package), Ok(true)) {
            return failed("PACKAGE_INTEGRITY_FAILED", Some(&package.package_id));
        }
        let header = match open_package(&path).and_then(|db| package_header(&db)) {
            Ok(value) => value,
            Err(_) => return failed("PACKAGE_INVALID", Some(&package.package_id)),
        };
        if header["packageId"] != package.package_id || header["version"] != package.version {
            return failed("PACKAGE_INVALID", Some(&package.package_id));
        }
        let mut active = header;
        active["fileKey"] = json!(path.file_name().unwrap_or_default().to_string_lossy());
        active["bytes"] = json!(package.bytes);
        active["sha256"] = json!(package.sha256);
        packages.push(active);
    }
    Outcome::Ok {
        value: PackageStack {
            generation: manifest.generation.unwrap_or(1),
            packages,
        },
    }
}

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub(crate) enum ContentQuery {
    ModuleQuery {
        #[serde(rename = "packageId")]
        package_id: String,
        query: Box<ContentQuery>,
    },
    Cards {
        locale: String,
        #[serde(rename = "afterCode")]
        after_code: i64,
        limit: i64,
    },
    CardSearch {
        locale: String,
        prefix: String,
        limit: i64,
    },
    Config {
        #[serde(rename = "packageId")]
        package_id: String,
    },
    Scripts {
        #[serde(rename = "afterName")]
        after_name: String,
        limit: i64,
    },
    Decks {
        #[serde(rename = "packageId")]
        package_id: String,
    },
    Opponents {
        #[serde(rename = "packageId")]
        package_id: String,
    },
    Limits {
        #[serde(rename = "packageId")]
        package_id: String,
    },
    Sets {
        #[serde(rename = "packageId")]
        package_id: String,
    },
    Story {
        #[serde(rename = "packageId")]
        package_id: String,
        #[serde(rename = "contentId")]
        content_id: String,
    },
    Asset {
        #[serde(rename = "packageId")]
        package_id: String,
        path: String,
    },
    SetImage {
        #[serde(rename = "setId")]
        set_id: String,
    },
}

impl ContentQuery {
    fn io_category(&self) -> Category {
        match self {
            Self::ModuleQuery { query, .. } => query.io_category(),
            Self::Scripts { .. } => Category::Scripts,
            Self::Config { .. } => Category::Config,
            Self::SetImage { .. } => Category::Media,
            Self::Asset { package_id, path } => {
                if package_id == "duel-core"
                    && ["engine/ocgcore.sync.wasm", "engine/vendor-manifest.json"]
                        .contains(&path.as_str())
                {
                    Category::Engine
                } else {
                    Category::Media
                }
            }
            _ => Category::Gameplay,
        }
    }

    fn package_id(&self) -> &str {
        match self {
            Self::Cards { .. }
            | Self::CardSearch { .. }
            | Self::Scripts { .. }
            | Self::Sets { .. }
            | Self::SetImage { .. } => "card-library",
            Self::ModuleQuery { package_id, .. }
            | Self::Config { package_id }
            | Self::Decks { package_id }
            | Self::Opponents { package_id }
            | Self::Limits { package_id }
            | Self::Story { package_id, .. }
            | Self::Asset { package_id, .. } => package_id,
        }
    }
    fn valid(&self) -> bool {
        match self {
            Self::ModuleQuery { package_id, query } => {
                (package_id == "card-library"
                    || package_id.starts_with("card-pack-")
                        && crate::native_package_manager::valid_id(package_id))
                    && matches!(
                        query.as_ref(),
                        Self::Cards { .. }
                            | Self::Scripts { .. }
                            | Self::Sets { .. }
                            | Self::SetImage { .. }
                    )
                    && query.valid()
            }
            Self::Cards {
                locale,
                after_code,
                limit,
            } => {
                !locale.is_empty()
                    && locale.len() <= 64
                    && *after_code >= 0
                    && (1..=500).contains(limit)
            }
            Self::CardSearch {
                locale,
                prefix,
                limit,
            } => {
                !locale.is_empty()
                    && locale.len() <= 64
                    && prefix.len() <= 1024
                    && (1..=100).contains(limit)
            }
            Self::Scripts { after_name, limit } => {
                after_name.len() <= 4096 && (1..=500).contains(limit)
            }
            Self::Story { content_id, .. } => !content_id.is_empty() && content_id.len() <= 256,
            Self::Asset { path, .. } => {
                !path.is_empty()
                    && path.len() <= 1024
                    && !path.starts_with('/')
                    && !path.contains("..")
                    && !path.contains('\\')
                    && !path.contains('\0')
            }
            Self::SetImage { set_id } => !set_id.is_empty() && set_id.len() <= 256,
            Self::Sets { package_id } => package_id == "card-library",
            _ => true,
        }
    }
}

#[tauri::command]
pub(crate) fn native_content_query(
    handle: tauri::AppHandle,
    request: ContentQuery,
) -> Outcome<Value> {
    let category = request.io_category();
    let _command = native_io_trace::start(category, Operation::Command, "native_content_query");
    if !request.valid() {
        return failed("RPC_INVALID", None);
    }
    let package_id = request.package_id().to_owned();
    let manifest = match installed(&handle) {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE", None),
    };
    let Some(package) = manifest
        .packages
        .iter()
        .find(|item| item.package_id == package_id)
    else {
        return failed("PACKAGE_NOT_FOUND", Some(&package_id));
    };
    let folder = match content_folder(&handle) {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE", None),
    };
    let db = match open_package_category(&package_path(&folder, package), category) {
        Ok(value) => value,
        Err(_) => return failed("PACKAGE_INVALID", Some(&package_id)),
    };
    let _query = native_io_trace::start(category, Operation::SqlQuery, "content-query");
    match execute_query(&db, request) {
        Ok(value) => Outcome::Ok { value },
        Err(_) => failed("PACKAGE_INVALID", Some(&package_id)),
    }
}

fn json_text(text: String) -> Result<Value, String> {
    serde_json::from_str(&text).map_err(|error| error.to_string())
}

fn collect<T, F>(
    db: &Connection,
    sql: &str,
    params: &[&dyn rusqlite::ToSql],
    mut row_fn: F,
) -> Result<Value, String>
where
    F: FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<T>,
    T: Serialize,
{
    let mut statement = db.prepare(sql).map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params, |row| row_fn(row))
        .map_err(|error| error.to_string())?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|error| error.to_string())?);
    }
    serde_json::to_value(result).map_err(|error| error.to_string())
}

fn execute_query(db: &Connection, request: ContentQuery) -> Result<Value, String> {
    match request {
        ContentQuery::ModuleQuery { query, .. } => execute_query(db, *query),
        ContentQuery::Cards {
            locale,
            after_code,
            limit,
        } => {
            let rows = collect(db, "SELECT c.definition_json,t.name,t.description,t.strings_json FROM cards c JOIN card_texts t ON t.card_code=c.code WHERE t.locale=? AND c.code>? ORDER BY c.code ASC LIMIT ?", &[&locale, &after_code, &limit], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?, row.get::<_, String>(3)?)))?;
            let mut cards = Vec::new();
            for item in rows.as_array().ok_or("rows")? {
                let mut definition = json_text(item[0].as_str().ok_or("definition")?.to_owned())?;
                let code = definition["code"].as_i64().ok_or("code")?;
                definition["name"] = item[1].clone();
                definition["description"] = item[2].clone();
                definition["strings"] = json_text(item[3].as_str().ok_or("strings")?.to_owned())?;
                definition["images"] = json!({"full":{"code":code,"variant":"full"},"cropped":{"code":code,"variant":"cropped"}});
                cards.push(definition);
            }
            Ok(Value::Array(cards))
        }
        ContentQuery::CardSearch {
            locale,
            prefix,
            limit,
        } => {
            let normalized = prefix
                .to_lowercase()
                .replace('\\', "\\\\")
                .replace('%', "\\%")
                .replace('_', "\\_");
            collect(db, "SELECT card_code FROM card_search WHERE locale=? AND normalized_name LIKE ? ESCAPE '\\' ORDER BY normalized_name ASC,card_code ASC LIMIT ?", &[&locale, &format!("{normalized}%"), &limit], |row| row.get::<_, i64>(0))
        }
        ContentQuery::Config { .. } => {
            let value: String = db
                .query_row(
                    "SELECT value_json FROM package_meta WHERE key='config'",
                    [],
                    |row| row.get(0),
                )
                .map_err(|error| error.to_string())?;
            json_text(value)
        }
        ContentQuery::Scripts { after_name, limit } => collect(
            db,
            "SELECT name,source FROM scripts WHERE name>? ORDER BY name ASC LIMIT ?",
            &[&after_name, &limit],
            |row| Ok(json!({"name":row.get::<_, String>(0)?,"source":row.get::<_, String>(1)?})),
        ),
        ContentQuery::Decks { .. } => {
            let rows = collect(
                db,
                "SELECT id,name,cards_json FROM decks ORDER BY id",
                &[],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                },
            )?;
            let mut decks = Vec::new();
            for item in rows.as_array().ok_or("rows")? {
                let mut cards = json_text(item[2].as_str().ok_or("cards")?.to_owned())?;
                cards["id"] = item[0].clone();
                cards["name"] = item[1].clone();
                decks.push(cards);
            }
            Ok(Value::Array(decks))
        }
        ContentQuery::Opponents { .. } => collect(
            db,
            "SELECT id,name,line,deck_id,policy_id FROM opponents ORDER BY id",
            &[],
            |row| {
                Ok(
                    json!({"id":row.get::<_, String>(0)?,"name":row.get::<_, String>(1)?,"line":row.get::<_, String>(2)?,"deckId":row.get::<_, String>(3)?,"policyId":row.get::<_, String>(4)?}),
                )
            },
        ),
        ContentQuery::Limits { package_id } => {
            let table = if package_id == "freeplay" {
                "freeplay_card_limits"
            } else {
                "chapter_card_limits"
            };
            collect(
                db,
                &format!("SELECT card_code,deck_limit FROM {table} ORDER BY card_code"),
                &[],
                |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
            )
        }
        ContentQuery::Sets { .. } => {
            let rows = collect(
                db,
                "SELECT id,metadata_json FROM sets ORDER BY id",
                &[],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )?;
            let mut sets = Vec::new();
            for item in rows.as_array().ok_or("rows")? {
                let id = item[0].as_str().ok_or("id")?;
                let metadata = json_text(item[1].as_str().ok_or("metadata")?.to_owned())?;
                let cards = collect(db, "SELECT sc.card_code,ct.name,sc.rarity,sc.printing_code,sc.source_rarity,sc.source_rarity_code FROM set_cards sc JOIN card_texts ct ON ct.card_code=sc.card_code AND ct.locale='en' WHERE sc.set_id=? ORDER BY sc.card_code,sc.printing_code,sc.source_rarity,sc.source_rarity_code", &[&id], |row| Ok(json!({"code":row.get::<_, i64>(0)?,"name":row.get::<_, String>(1)?,"rarity":row.get::<_, String>(2)?,"printingCode":row.get::<_, String>(3)?,"sourceRarity":row.get::<_, String>(4)?,"sourceRarityCode":row.get::<_, String>(5)?})))?;
                // Storage metadata (for example imageAssetPath) stays behind
                // the media reader. Story receives the semantic set contract.
                sets.push(json!({
                    "id": metadata["id"],
                    "name": metadata["name"],
                    "releaseYear": metadata["releaseYear"],
                    "cards": cards,
                }));
            }
            Ok(Value::Array(sets))
        }
        ContentQuery::Story { content_id, .. } => {
            let value: Option<String> = db
                .query_row(
                    "SELECT payload_json FROM story_documents WHERE id=?",
                    params![content_id],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|error| error.to_string())?;
            value
                .map(json_text)
                .transpose()
                .map(|value| value.unwrap_or(Value::Null))
        }
        ContentQuery::Asset { package_id, path } => {
            let required = package_id == "duel-core"
                && ["engine/ocgcore.sync.wasm", "engine/vendor-manifest.json"]
                    .contains(&path.as_str());
            match asset(
                db,
                &path,
                if package_id == "duel-core" {
                    16 * 1024 * 1024
                } else {
                    64 * 1024 * 1024
                },
            ) {
                Ok(Value::Null) if required => Err("Required engine asset missing".into()),
                Err(_) if !required => Ok(Value::Null),
                value => value,
            }
        }
        ContentQuery::SetImage { set_id } => {
            let lookup = (|| -> Result<Value, String> {
                let metadata: Option<String> = db
                    .query_row(
                        "SELECT metadata_json FROM sets WHERE id=?",
                        params![set_id],
                        |row| row.get(0),
                    )
                    .optional()
                    .map_err(|error| error.to_string())?;
                let Some(metadata) = metadata else {
                    return Ok(Value::Null);
                };
                let parsed = json_text(metadata)?;
                let Some(path) = parsed["imageAssetPath"].as_str() else {
                    return Ok(Value::Null);
                };
                asset(db, path, 64 * 1024 * 1024)
            })();
            Ok(lookup.unwrap_or(Value::Null))
        }
    }
}

fn asset(db: &Connection, path: &str, cap: i64) -> Result<Value, String> {
    let metadata: Option<(String, i64, i64, String)> = db
        .query_row(
            "SELECT mime,byte_length,length(data),sha256 FROM assets WHERE path=?",
            params![path],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let Some((mime, length, actual_length, sha256)) = metadata else {
        return Ok(Value::Null);
    };
    if length < 0 || length > cap || length != actual_length {
        return Err("Asset length invalid".into());
    }
    let bytes: Vec<u8> = db
        .query_row(
            "SELECT data FROM assets WHERE path=?",
            params![path],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if bytes.len() as i64 != length || format!("{:x}", Sha256::digest(&bytes)) != sha256 {
        return Err("Asset integrity mismatch".into());
    }
    Ok(json!({"mime":mime,"bytes":bytes}))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn story_sets_expose_semantic_fields_and_keep_media_metadata_private() {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch("CREATE TABLE sets(id TEXT, metadata_json TEXT);
            CREATE TABLE set_cards(set_id TEXT,card_code INTEGER,rarity TEXT,printing_code TEXT,source_rarity TEXT,source_rarity_code TEXT);
            CREATE TABLE card_texts(card_code INTEGER,locale TEXT,name TEXT);
            INSERT INTO card_texts VALUES(123,'en','Test card');
            INSERT INTO set_cards VALUES('first',123,'Common','FIRST-001','Common','C');").unwrap();
        db.execute("INSERT INTO sets VALUES(?,?)", params!["first", json!({"id":"first","name":"First set","releaseYear":2002,"imageAssetPath":"sets/first.jpg"}).to_string()]).unwrap();
        let sets = execute_query(
            &db,
            ContentQuery::Sets {
                package_id: "card-library".into(),
            },
        )
        .unwrap();
        let keys: Vec<_> = sets[0]
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        assert_eq!(keys, vec!["cards", "id", "name", "releaseYear"]);
        assert_eq!(sets[0]["cards"][0]["code"], 123);
        assert_eq!(sets[0]["cards"][0]["name"], "Test card");
    }
}
