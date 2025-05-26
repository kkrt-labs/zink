# Zink: Programmable Credentials MVP

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

[![Status](https://img.shields.io/badge/status-work_in_progress-red.svg)](https://github.com/kkrt-labs)

Welcome to Zink! This project is a Minimum Viable Product (MVP) aiming to explore and demonstrate **Programmable Credentials**.

## ⚠️ IMPORTANT DISCLAIMER: WORK IN PROGRESS ⚠️

This project is currently in a very early Work-In-Progress (WIP) state.

- It is **not yet fully functional** for all intended real-world use cases.
- It has **not been audited** for security, correctness, or privacy.
- The codebase is subject to significant changes, refactoring, or even complete overhauls without notice.

Please use it for learning, experimentation, or contribution purposes only. **Do not use it in production or with sensitive data.**

## Project Goal

Our primary goal is to build an MVP that showcases the potential of programmable credentials. We aim to combine the power of zero-knowledge proofs with a mobile-first approach to push the frontier for privacy-preserving programmable credentials.

## Technology Stack

Zink is built with a state-of-the-art, cross-platform, and privacy-focused stack:

- **Zero-Knowledge Proofs:**
  - **Noir:** [A Domain Specific Language](https://noir-lang.org/docs) for writing zero-knowledge circuits. (Example circuit in `assets/noir/`)
  - **ProveKit (Rust Backend):** Utilizes `noir-r1cs` from [ProveKit](https://github.com/worldfnd/ProveKit) for generating and verifying proofs with Noir circuits.
- **Native Integration & Core Logic:**
  - **Rust Library (Nightly Toolchain):** For implementing core ZK logic, cryptographic operations, and performance-sensitive components. Reuses Noir & ProveKit libraries.
  - **UniFFI:** For generating seamless, [type-safe bindings](https://github.com/mozilla/uniffi-rs) between Rust and mobile native languages (Kotlin for Android, Swift for iOS).
- **Mobile Application:**
  - **React Native:** For building the cross-platform user interface.
  - **Expo (ejected):** To streamline development, building, and iteration, specifically utilizing:
    - **Expo Development Builds:** For a robust native development experience allowing custom native code.
    - **Expo Native Modules:** For integrating our Rust/UniFFI powered `zk-bindings` (for ZK operations) as well as native code, e.g. `mrz-reader` (for passport scanning) modules.
  - **Expo Router:** For file-based routing within the app.
  - **@tanstack/react-query:** For managing asynchronous state and server interactions.

## Features (Current MVP State)

- **Passport MRZ Scanning:** Uses the device camera to scan the Machine Readable Zone (MRZ) of passports.
- **NFC Passport Reading:** Reads data from ePassports using NFC after obtaining MRZ details.
- **ZK Proof Generation & Verification:** Generating and verifying proofs using the integrated Rust ZK backend. This can be tested via the "Proof Generation" screen.

## Getting Started

### Prerequisites

1.  **Node.js & npm:** Install [Node.js](https://nodejs.org/en/download) (LTS version recommended, e.g., 18.x or later) and npm.
2.  **Rust (Nightly Toolchain):** Install Rust (https://www.rust-lang.org/tools/install).

    - The project uses the **nightly** toolchain for Rust. The `native_rust/rust-toolchain.toml` file will typically set this up for you automatically when you `cd` into the `native_rust` directory or run cargo commands from the root (`cargo +nightly <build or run>`).

3.  **Expo CLI:** Install the Expo CLI: `npm install -g expo-cli`.
4.  **Platform-Specific Tooling:** - **Android:** Android Studio (for SDK, emulator, and build tools). - **iOS:** Xcode (for SDK, simulator, and build tools) and CocoaPods (`sudo gem install cocoapods`). [CocoaPods](https://guides.cocoapods.org/using/getting-started.html#installation) recommends not using the MacOS system's version of Ruby, and install it through other means, e.g. homebrew.
5.  **Rust Targets:** Install the necessary targets for cross-compilation:
    ```bash
    rustup target add aarch64-linux-android
    rustup target add aarch64-apple-ios
    rustup target add aarch64-apple-ios-sim
    ```
6.  **`cargo-ndk`:** For Android Rust builds:
    ```bash
    cargo install cargo-ndk
    ```

### Setup and Running the App

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/kkrt-labs/zink.git
    cd zink
    ```

2.  **Install JavaScript dependencies:**

    ```bash
    npm install
    ```

3.  **Generate Native Bindings:**
    This step compiles the Rust code in `native_rust/` (for ZK bindings) and prepares the native modules (`zk-bindings`, `mrz-reader`).
    ⚠️ Running `npm run generate-bindings` will generate ios bindings simulator, not for device. For ios devices, run `node scripts/setup_rust_bindings.mjs --ios-device`

    ```bash
    npm run generate-bindings
    # or specifically:
    # node scripts/setup_rust_bindings.mjs --all
    ```

    _You'll need to re-run this command whenever you make changes to the Rust code in `native_rust/src/lib.rs`._

4.  **Run the app:**
    - **For Android:**
      ```bash
      npx expo run:android
      ```
    - **For iOS:**
      ```bash
      npx expo run:ios
      ```
    - **For Web (Native modules like `zk-bindings` and `mrz-reader` will have limited or no functionality):**
      ```bash
      npx expo start --web
      ```

#### Caveats

- `npx expo run:ios` or `npx expo run:android` may fail for unknown reasons, try running `npm run generate-bindings` and `npx expo prebuild --clean` before-hand in that case.
- `npx expo prebuild --clean` might fail, in that case, try a local eas build: `eas build --platform android --profile development  --local` or `eas build --platform ios --profile development --local`. Make sure to run the command with the `--local`. You'll then have to upload the `.apk` or `.ipa` resulting files to a mobile device. For that, consider using [Expo Orbit](https://github.com/expo/orbit).

**Notes on Native Builds:**

- The `generate-bindings` script (which calls `setup_rust_bindings.mjs`) handles compiling Rust, generating Swift/Kotlin bindings, and placing them into the `modules/zk-bindings/` directory. It also runs `pod install` for iOS.
- If you encounter issues with native builds for the first time, ensure your Android Studio / Xcode setups are correct. Sometimes, opening the `android/` project in Android Studio or the `ios/` project in Xcode once can help resolve initial setup or dependency issues.
- The `mrz-reader` module contains native code for camera access and MRZ parsing. The `zk-bindings` module is for the Rust-based ZK functionalities.

## Project Structure Highlights

- `app/`: Contains the React Native screens and navigation logic (using Expo Router).
  - `proof.tsx`: Screen for demonstrating ZK proof generation and verification.
- `assets/`: Static assets.
  - `noir/poseidon-example.json`: A sample compiled Noir circuit.
- `modules/`: Houses local Expo Native Modules.
  - `mrz-reader/`: Native module for MRZ (Machine Readable Zone) scanning from documents.
  - `zk-bindings/`: Native module bridging Rust ZK logic to JavaScript via UniFFI.
- `native_rust/`: The Rust crate containing the core logic for ZK operations and other native utilities.
  - `src/lib.rs`: Main Rust library code.
  - `Cargo.toml`: Rust project dependencies and configuration (uses `edition = "2021"` for compilation, though `rustfmt.toml` uses `2024` for styling).
  - `rust-toolchain.toml`: Specifies the Rust nightly toolchain.
- `scripts/`: Contains helper scripts, including `setup_rust_bindings.mjs` for building and integrating Rust code.
- `eas-hooks/`: Scripts used during EAS Build to set up the Rust environment.

## Contributing

We welcome contributions! As this is an early-stage project, there are many areas to contribute, from core ZK logic and circuit design to UI/UX improvements and documentation.

Please feel free to:

- Open issues for bugs, feature requests, or questions.
- Submit pull requests with improvements (please discuss significant changes in an issue first, especially for architectural decisions).

_More detailed contribution guidelines will be added as the project matures._

## License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for the full license text.

---

_This README is a living document and will be updated as the project evolves._
