// Build contracts and rust.
use std::env;
use std::path::Path;
use std::process::Command;

fn main() {
    let out_dir = env::var("OUT_DIR").unwrap();
    println!("Installing contracts={}", out_dir);
    Command::new("yarn")
        .args(&["install"])
        .current_dir(&Path::new(&out_dir))
        .status()
        .unwrap();
    println!("Building contracts={}", out_dir);
    Command::new("yarn")
        .args(&["build"])
        .current_dir(&Path::new(&out_dir))
        .status()
        .unwrap();
}
