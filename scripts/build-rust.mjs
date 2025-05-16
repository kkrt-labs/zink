// scripts/build-rust.mjs
import { execSync } from "child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, "..");
const rustProjectDir = join(projectRoot, "zink-rust-lib");
const nativeModuleDir = join(projectRoot, "modules", "zk-bindings");

const rustLibName = "zink_rust_lib";
const udlFileName = "zink_interface";
const udlNamespace = "zink_lib";

// Define Rust build targets
const targets = {
  ios: [
    { rust: "aarch64-apple-ios", outputDirSuffix: "" },
    { rust: "aarch64-apple-ios-sim", outputDirSuffix: "-sim-arm64" },
  ],
  android: [
    { rust: "aarch64-linux-android", abi: "arm64-v8a" },
    { rust: "armv7-linux-androideabi", abi: "armeabi-v7a" },
    { rust: "i686-linux-android", abi: "x86" },
    { rust: "x86_64-linux-android", abi: "x86_64" },
  ],
};

function executeCommand(command, cwd = rustProjectDir) {
  console.log(`Executing: ${command} in ${cwd}`);
  try {
    execSync(command, { stdio: "inherit", cwd });
  } catch (error) {
    console.error(`Error executing: ${command}`, error);
    process.exit(1);
  }
}

function ensureDirExists(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

function copyRecursiveSync(src, dest) {
  const exists = existsSync(src);
  const stats = exists && statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    ensureDirExists(dest);
    readdirSync(src).forEach(function (childItemName) {
      copyRecursiveSync(join(src, childItemName), join(dest, childItemName));
    });
  } else if (exists) {
    ensureDirExists(dirname(dest));
    copyFileSync(src, dest);
  }
}

// --- Main Build Steps ---
const uniffiGeneratedBindingsDir = join(
  rustProjectDir,
  "generated-uniffi-bindings",
);
if (existsSync(uniffiGeneratedBindingsDir)) {
  rmSync(uniffiGeneratedBindingsDir, { recursive: true, force: true });
  console.log("Cleaned previous UniFFI generated bindings.");
}
ensureDirExists(uniffiGeneratedBindingsDir);

console.log("\nBuilding Rust project (generates Rust FFI scaffolding)...");
const sampleBuildTarget =
  targets.android.find((t) => t.abi === "arm64-v8a") || targets.ios[0];
if (!sampleBuildTarget) {
  console.error(
    "Error: No suitable sample build target found for initial Rust build.",
  );
  process.exit(1);
}
executeCommand(
  `cargo build --manifest-path=${join(rustProjectDir, "Cargo.toml")} --target ${sampleBuildTarget.rust} --release`,
);

console.log("\n--- Generating UniFFI foreign language bindings ---");
const udlFilePathInRustProject = join("src", `${udlFileName}.udl`);

const swiftBindingsOutDir = join(uniffiGeneratedBindingsDir, "swift");
ensureDirExists(swiftBindingsOutDir);
executeCommand(
  `cargo run --bin uniffi-bindgen -- generate "${udlFilePathInRustProject}" --language swift --out-dir "${swiftBindingsOutDir}"`,
  rustProjectDir,
);

const kotlinBindingsOutDir = join(uniffiGeneratedBindingsDir, "kotlin");
ensureDirExists(kotlinBindingsOutDir);
executeCommand(
  `cargo run --bin uniffi-bindgen -- generate "${udlFilePathInRustProject}" --language kotlin --out-dir "${kotlinBindingsOutDir}"`,
  rustProjectDir,
);

// For iOS
const iosModuleSwiftDir = join(nativeModuleDir, "ios");
const iosModuleIncludeDir = join(nativeModuleDir, "ios", "include");
ensureDirExists(iosModuleSwiftDir);
ensureDirExists(iosModuleIncludeDir);

const generatedSwiftHeader = join(swiftBindingsOutDir, `${udlNamespace}FFI.h`);
const generatedSwiftFile = join(swiftBindingsOutDir, `${udlNamespace}.swift`);
// UniFFI also generates a modulemap file for Swift which is useful
const generatedSwiftModuleMap = join(
  swiftBindingsOutDir,
  `${udlNamespace}FFI.modulemap`,
);

if (existsSync(generatedSwiftHeader)) {
  copyFileSync(
    generatedSwiftHeader,
    join(iosModuleIncludeDir, `${udlNamespace}FFI.h`),
  );
  console.log(
    `Copied UniFFI C header to: ${join(iosModuleIncludeDir, `${udlNamespace}FFI.h`)}`,
  );
} else {
  console.warn(
    `Warning: UniFFI generated C header not found at ${generatedSwiftHeader}`,
  );
}

if (existsSync(generatedSwiftFile)) {
  copyFileSync(
    generatedSwiftFile,
    join(iosModuleSwiftDir, `${udlNamespace}UniFFI.swift`),
  );
  console.log(
    `Copied UniFFI Swift file to: ${join(iosModuleSwiftDir, `${udlNamespace}UniFFI.swift`)}`,
  );
} else {
  console.warn(
    `Warning: UniFFI generated Swift file not found at ${generatedSwiftFile}`,
  );
}

if (existsSync(generatedSwiftModuleMap)) {
  copyFileSync(
    generatedSwiftModuleMap,
    join(iosModuleIncludeDir, `${udlNamespace}FFI.modulemap`),
  );
  console.log(
    `Copied UniFFI module map to: ${join(iosModuleIncludeDir, `${udlNamespace}FFI.modulemap`)}`,
  );
} else {
  console.warn(
    `Warning: UniFFI generated module map not found at ${generatedSwiftModuleMap}`,
  );
}

// For Android (Kotlin files)
console.log("\n--- Copying Kotlin files ---");
const androidModuleKotlinBaseDir = join(
  nativeModuleDir,
  "android",
  "src",
  "main",
  "java",
);
// Adjusted path based on screenshot: generated-uniffi-bindings/kotlin/uniffi/zink_lib/
const kotlinGeneratedSrcActualDir = join(
  kotlinBindingsOutDir,
  "uniffi",
  udlNamespace,
);

if (
  existsSync(kotlinGeneratedSrcActualDir) &&
  statSync(kotlinGeneratedSrcActualDir).isDirectory()
) {
  // The destination in your Android module should still be based on your package structure,
  // e.g., .../java/zink_lib/ (where zink_lib is your UDL namespace)
  const kotlinDestDirWithNamespace = join(
    androidModuleKotlinBaseDir,
    udlNamespace,
  );
  copyRecursiveSync(kotlinGeneratedSrcActualDir, kotlinDestDirWithNamespace);
  console.log(
    `Copied UniFFI Kotlin package from ${kotlinGeneratedSrcActualDir} to: ${kotlinDestDirWithNamespace}`,
  );
} else {
  console.warn(
    `Warning: Expected Kotlin directory ${kotlinGeneratedSrcActualDir} not found. Please verify UniFFI output structure for Kotlin.`,
  );
}

// --- Building Rust for all iOS targets ---
console.log("\n--- Building Rust for all iOS targets ---");
const iosLibDir = join(nativeModuleDir, "ios", "lib");
ensureDirExists(iosLibDir);

targets.ios.forEach((target) => {
  executeCommand(
    `cargo build --manifest-path=${join(rustProjectDir, "Cargo.toml")} --target ${target.rust} --release`,
  );
});

const deviceTarget = targets.ios.find((t) => t.rust === "aarch64-apple-ios");
if (deviceTarget) {
  const deviceLibPath = join(
    rustProjectDir,
    "target",
    deviceTarget.rust,
    "release",
    `lib${rustLibName}.a`,
  );
  const destDeviceLibPath = join(iosLibDir, `lib${rustLibName}.a`);
  if (existsSync(deviceLibPath)) {
    copyFileSync(deviceLibPath, destDeviceLibPath);
    console.log(
      `Copied iOS device library (aarch64-apple-ios) to: ${destDeviceLibPath}`,
    );
  } else {
    console.warn(`iOS device library not found at ${deviceLibPath}`);
  }
} else {
  console.warn(
    "ARM64 device target (aarch64-apple-ios) not defined in targets.ios",
  );
}

const simArmTarget = targets.ios.find(
  (t) => t.rust === "aarch64-apple-ios-sim",
);
if (simArmTarget) {
  const simArmLibPath = join(
    rustProjectDir,
    "target",
    simArmTarget.rust,
    "release",
    `lib${rustLibName}.a`,
  );
  const destSimArmLibPath = join(iosLibDir, `lib${rustLibName}-sim-arm64.a`);
  if (existsSync(simArmLibPath)) {
    copyFileSync(simArmLibPath, destSimArmLibPath);
    console.log(`Copied iOS ARM64 simulator library to: ${destSimArmLibPath}`);
  } else {
    console.warn(`iOS ARM64 simulator library not found at ${simArmLibPath}`);
  }
}

// --- Building Rust for all Android targets & copying .so files ---
console.log(
  "\n--- Building Rust for all Android targets & copying .so files ---",
);
const androidJniLibsBaseDir = join(
  nativeModuleDir,
  "android",
  "src",
  "main",
  "jniLibs",
);
targets.android.forEach((target) => {
  executeCommand(
    `cargo build --manifest-path=${join(rustProjectDir, "Cargo.toml")} --target ${target.rust} --release`,
  );
  const libPath = join(
    rustProjectDir,
    "target",
    target.rust,
    "release",
    `lib${rustLibName}.so`,
  );
  const destDir = join(androidJniLibsBaseDir, target.abi);
  ensureDirExists(destDir);
  const destLibPath = join(destDir, `lib${rustLibName}.so`);
  copyFileSync(libPath, destLibPath);
  console.log(`Copied Android library for ${target.abi} to: ${destLibPath}`);
});

console.log(
  "\nRust build, UniFFI binding generation, and artifact copying complete!",
);
