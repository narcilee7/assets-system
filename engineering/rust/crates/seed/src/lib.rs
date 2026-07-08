//! Placeholder crate for the `engineering/rust/` workspace.
//!
//! This crate exists only to verify that the Cargo toolchain is wired up
//! correctly (`cargo build --workspace`, `cargo test --workspace`).
//! Replace it with the first real `tested` asset when one lands.

/// Sanity check: workspace compiles and tests run.
pub fn workspace_is_wired() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn smoke() {
        assert!(workspace_is_wired());
    }
}