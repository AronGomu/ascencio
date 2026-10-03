fn main() {
    let release = std::fs::read_to_string("../content/critical-release.json")
        .expect("tracked trusted critical release");
    if let Ok(staged) = std::fs::read_to_string("resources/readable-content/release.json") {
        assert_eq!(staged, release, "staged release must match tracked trust anchor");
    }
    std::fs::write(
        std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("critical-release.json"),
        release,
    )
    .expect("embed trusted critical release");
    println!("cargo:rerun-if-changed=resources/readable-content/release.json");
    println!("cargo:rerun-if-changed=../content/critical-release.json");
    std::fs::create_dir_all("resources/readable-content")
        .expect("create native resource directory");
    tauri_build::build()
}
