use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::{env, fs, path::PathBuf};

fn main() {
    let manifest_dir = PathBuf::from(
        env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is required"),
    );
    let icons_dir = manifest_dir.join("icons");
    let icon_path = icons_dir.join("icon.ico");
    let icon_source = icons_dir.join("icon.ico.base64");

    if !icon_path.exists() {
        fs::create_dir_all(&icons_dir).expect("failed to create icons directory");
        let encoded = fs::read_to_string(&icon_source)
            .expect("src-tauri/icons/icon.ico.base64 is required");
        let bytes = STANDARD
            .decode(encoded.trim())
            .expect("invalid base64 icon source");
        fs::write(&icon_path, bytes).expect("failed to create src-tauri/icons/icon.ico");
    }

    tauri_build::build()
}
