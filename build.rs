// Build contracts and rust.
use std::process::Command;

fn main() {
    println!("Installing contracts...");
    Command::new("yarn").args(&["install"]).status().unwrap();
    println!("Building contracts...");
    Command::new("yarn").args(&["build"]).status().unwrap();
}
