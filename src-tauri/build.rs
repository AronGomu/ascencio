fn main() {
    std::fs::create_dir_all("resources/game-content").expect("create native resource directory");
    tauri_build::build()
}
