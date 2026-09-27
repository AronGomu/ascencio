export const PACKAGE_SCHEMA_SQL = `
PRAGMA journal_mode=DELETE;
PRAGMA user_version=1;
CREATE TABLE package_manifest (
  package_id TEXT PRIMARY KEY,
  package_type TEXT NOT NULL,
  version TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  dependencies_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE package_meta (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);
CREATE TABLE assets (
  path TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  byte_length INTEGER NOT NULL CHECK (byte_length >= 0),
  sha256 TEXT NOT NULL,
  data BLOB NOT NULL,
  CHECK (length(data) = byte_length)
);`;

export const CARD_LIBRARY_SCHEMA_SQL = `
CREATE TABLE cards (code INTEGER PRIMARY KEY, definition_json TEXT NOT NULL);
CREATE TABLE card_texts (
  card_code INTEGER NOT NULL REFERENCES cards(code),
  locale TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  strings_json TEXT NOT NULL,
  PRIMARY KEY (card_code, locale)
);
CREATE TABLE scripts (name TEXT PRIMARY KEY, source TEXT NOT NULL, sha256 TEXT NOT NULL);
CREATE TABLE sets (id TEXT PRIMARY KEY, metadata_json TEXT NOT NULL);
CREATE TABLE set_cards (
  set_id TEXT NOT NULL REFERENCES sets(id),
  card_code INTEGER NOT NULL REFERENCES cards(code),
  printing_code TEXT NOT NULL,
  rarity TEXT NOT NULL,
  source_rarity TEXT NOT NULL,
  source_rarity_code TEXT NOT NULL,
  PRIMARY KEY (set_id, card_code, printing_code, source_rarity, source_rarity_code)
);
CREATE TABLE card_search (
  locale TEXT NOT NULL,
  card_code INTEGER NOT NULL REFERENCES cards(code),
  normalized_name TEXT NOT NULL,
  PRIMARY KEY (locale, card_code)
);
CREATE INDEX card_search_name ON card_search(locale, normalized_name, card_code);`;

export const FREEPLAY_SCHEMA_SQL = `
CREATE TABLE decks (id TEXT PRIMARY KEY, name TEXT NOT NULL, cards_json TEXT NOT NULL);
CREATE TABLE opponents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  line TEXT NOT NULL,
  deck_id TEXT NOT NULL REFERENCES decks(id),
  policy_id TEXT NOT NULL
);
CREATE TABLE freeplay_card_limits (
  card_code INTEGER PRIMARY KEY,
  deck_limit INTEGER NOT NULL CHECK (deck_limit IN (0, 1, 2))
);`;

export const CHAPTER_SCHEMA_SQL = `
CREATE TABLE decks (id TEXT PRIMARY KEY, name TEXT NOT NULL, cards_json TEXT NOT NULL);
CREATE TABLE opponents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  line TEXT NOT NULL,
  deck_id TEXT NOT NULL REFERENCES decks(id),
  policy_id TEXT NOT NULL
);
CREATE TABLE chapter_card_limits (
  card_code INTEGER PRIMARY KEY,
  deck_limit INTEGER NOT NULL CHECK (deck_limit IN (0, 1, 2))
);
CREATE TABLE story_documents (id TEXT PRIMARY KEY, payload_json TEXT NOT NULL);`;

export const CONTENT_REGISTRY_SCHEMA_SQL = `
PRAGMA journal_mode=DELETE;
PRAGMA user_version=1;
CREATE TABLE registry_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton=1),
  generation INTEGER NOT NULL CHECK (generation>=0)
);
INSERT INTO registry_state VALUES (1,0);
CREATE TABLE installed_packages (
  package_id TEXT PRIMARY KEY,
  manifest_json TEXT NOT NULL,
  file_key TEXT NOT NULL UNIQUE,
  byte_length INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  verified_at TEXT NOT NULL
);
CREATE TABLE import_receipts (
  operation_id TEXT PRIMARY KEY,
  generation INTEGER NOT NULL,
  package_ids_json TEXT NOT NULL,
  completed_at TEXT NOT NULL
);`;

export const USER_DATA_SCHEMA_SQL = `
PRAGMA journal_mode=DELETE;
PRAGMA user_version=1;
CREATE TABLE user_data_meta (
  singleton INTEGER PRIMARY KEY CHECK (singleton=1),
  format TEXT NOT NULL CHECK (format='ascencio-user-data'),
  schema_version INTEGER NOT NULL CHECK (schema_version=1),
  revision INTEGER NOT NULL CHECK (revision>=0)
);
INSERT INTO user_data_meta VALUES (1,'ascencio-user-data',1,0);
CREATE TABLE user_records (
  namespace TEXT NOT NULL,
  record_key TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision>=1),
  payload_json TEXT NOT NULL,
  PRIMARY KEY (namespace,record_key)
);`;
