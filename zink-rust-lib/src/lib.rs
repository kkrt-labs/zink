use rand::Rng;

fn generate_random_number() -> i32 {
    let mut rng = rand::thread_rng();
    rng.gen_range(0..1000) // Generates a random i32 between 0 (inclusive) and 1000 (exclusive)
}

uniffi::include_scaffolding!("zink_interface");
