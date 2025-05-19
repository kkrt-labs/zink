# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Setup and Building Native Bindings

This project uses a Rust library (`native_rust`) integrated via UniFFI. The native bindings (Kotlin for Android, Swift for iOS) are generated and copied into the `zk-bindings` Expo module.

### Using the Setup Script (`setup_rust_bindings.mjs`)

A Node.js script is provided to automate the Rust compilation, binding generation, and file copying process.

1.  **Install script dependencies (if you haven't already):**
    ```bash
    npm install --save-dev execa yargs-parser
    ```
2.  **Run the script from the project root:**

    ```bash
    node scripts/setup_rust_bindings.mjs [options]
    ```

    **Available Options:**

    - `--all`: Build for Android (default arch: `aarch64-linux-android`) and iOS Simulator (default arch: `aarch64-apple-ios-sim`). This is the **default behavior** if no specific platform flags are provided.
    - `--android`: Build for Android only.
    - `--ios-sim`: Build for iOS Simulator only.
    - `--ios-device`: Build for iOS Device only (default arch: `aarch64-apple-ios`).
      - **Note**: If building for both device and simulator, be aware that `libnative_rust.a` might be overwritten. A proper setup for this scenario would involve creating a universal binary using `lipo`, which is not yet implemented in this script.
    - `--help` or `-h`: Display help information.

    **Example Usage:**

    - Build for all default platforms (Android arm64, iOS Simulator arm64):
      ```bash
      node scripts/setup_rust_bindings.mjs
      # or
      node scripts/setup_rust_bindings.mjs --all
      ```
    - Build for Android only:
      ```bash
      node scripts/setup_rust_bindings.mjs --android
      ```
    - Build for iOS Simulator and iOS Device:
      ```bash
      node scripts/setup_rust_bindings.mjs --ios-sim --ios-device
      ```

The script will:

- Check for necessary prerequisites (Rust targets, cargo-ndk, pod).
- Compile the Rust code in `/native_rust` for the specified platforms/architectures.
- Generate Kotlin and Swift bindings using UniFFI.
- Copy the compiled libraries (`.so` for Android, `.a` for iOS) and the generated bindings to the `/modules/zk-bindings` directory.
- Run `pod install` for iOS if any iOS platform was processed.

**When to re-run the script:**
You should re-run this script whenever you make changes to:

- The Rust code in `/native_rust/src/lib.rs`.
- The UniFFI definition file `/native_rust/src/math.udl`.

### Initial Project Setup (One-time)

If this is the first time setting up the project or if you've cleaned the native directories:

1.  **Install JavaScript dependencies:**

    ```bash
    npm install

    ```

2.  **Generate native platform projects (if not already present):**
    This step creates the `/ios` and `/android` directories at the project root, which are necessary for custom native code.
    ```bash
    npx expo prebuild --clean
    ```
    - **Android Note**: If `npx expo run:android` fails after prebuild with Gradle issues, opening the `./android` project in Android Studio once can often resolve these by allowing it to sync and set up correctly.
3.  **Run the `setup_rust_bindings.mjs` script** as described above to build and integrate the Rust code (e.g., `node scripts/setup_rust_bindings.mjs --all`).

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
