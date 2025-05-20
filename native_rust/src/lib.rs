uniffi::setup_scaffolding!();

#[uniffi::export]
pub fn add(left: i32, right: i32) -> i32 {
    left + right
}
