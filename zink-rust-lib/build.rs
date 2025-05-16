// rust/build.rs
fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Tell cargo to rerun this build script if the UDL file changes.
    println!("cargo:rerun-if-changed=src/zink_interface.udl");

    // Generate the Rust FFI scaffolding (the Rust side of the bridge)
    uniffi::generate_scaffolding("src/zink_interface.udl")?;
    Ok(())
}
