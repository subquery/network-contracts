// Build contracts and rust.
use std::process::Command;

fn main() {
    println!("Installing contracts...");
    let install_status = Command::new("npm")
        .args(&["install --force"])
        .status()
        .unwrap();
    if !install_status.success() {
        panic!("Node/yarn missing or run install failure.");
    }
    println!("Building contracts...");
    let build_status = Command::new("yarn")
        .args(&["build:contract"])
        .status()
        .unwrap();
    if !build_status.success() {
        panic!("Contract hardhat compile failure");
    }
}
