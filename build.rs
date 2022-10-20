// Build contracts and rust.
use std::process::Command;

fn main() {
    println!("Installing contracts...");
    let install_status = Command::new("npm")
        .args(&["install", "--force"])
        .status()
        .unwrap();
    if !install_status.success() {
        panic!("Node/npm missing or run install failure.");
    }
    println!("Building contracts...");
    let build_status = Command::new("npx")
        .args(&["hardhat", "compile"])
        .status()
        .unwrap();
    if !build_status.success() {
        panic!("npx hardhat compile failure");
    }
    println!("Clean cache...");
    let clean_status = Command::new("npx")
        .args(&["rimraf", "./**/node_modules"])
        .status()
        .unwrap();
    if !clean_status.success() {
        panic!("npx rimraf clean failure");
    }
}
