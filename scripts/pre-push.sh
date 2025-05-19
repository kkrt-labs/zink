#!/bin/bash

# Git pre-push hook to run local build checks before pushing
# Runs npm install, trunk check, Rust compilation, and Expo prebuild for Android/iOS
# Skips checks if no relevant files changed (caching)
# Place in .git/hooks/pre-push or .husky/pre-push and make executable: chmod +x
# To bypass (use sparingly): git push --no-verify

set -e  # Exit on any error

echo "🚀 Running pre-push build checks..."

# Define directories/files to monitor for changes
SOURCE_FILES="src/ native_rust/ scripts/ modules/ app.json"
CONFIG_FILES="package.json package-lock.json Cargo.toml .trunk/trunk.yaml"
CACHE_DIR=".git/hooks/cache"
CACHE_FILE="$CACHE_DIR/pre-push-hash"
LAST_COMMIT_FILE="$CACHE_DIR/last-commit"

# Create cache directory if it doesn't exist
mkdir -p "$CACHE_DIR"

# Get the current commit hash
CURRENT_COMMIT=$(git rev-parse HEAD)

# Function to compute hash of relevant files
compute_hash() {
    find $SOURCE_FILES $CONFIG_FILES -type f -not -path '*/node_modules/*' -not -path '*/target/*' -not -path '*/android/*' -not -path '*/ios/*' -exec sha256sum {} \; 2>/dev/null \
        | sort \
        | sha256sum \
        | awk '{print $1}'
}

# Function to check if a command is available
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ Error: $1 is not installed or not in PATH."
        echo "💡 Install it with: $2"
        exit 1
    else
        echo "✅ $1 is installed: $($1 --version)"
    fi
}

# Check if relevant files changed since last successful run
NEEDS_RUN=false
if [ -f "$CACHE_FILE" ] && [ -f "$LAST_COMMIT_FILE" ]; then
    LAST_HASH=$(cat "$CACHE_FILE")
    LAST_COMMIT=$(cat "$LAST_COMMIT_FILE")
    CURRENT_HASH=$(compute_hash)
    if [ "$LAST_HASH" = "$CURRENT_HASH" ] && [ "$LAST_COMMIT" = "$CURRENT_COMMIT" ]; then
        echo "ℹ️  No changes in source or config files since last successful run. Skipping checks."
        exit 0
    else
        NEEDS_RUN=true
    fi
else
    NEEDS_RUN=true
fi

# If changes detected or no cache, run checks
if [ "$NEEDS_RUN" = true ]; then
    # Check prerequisites
    echo "🔍 Checking prerequisites..."
    check_command "node" "nvm install 18 || brew install node"
    check_command "npm" "nvm install 18 || brew install node"
    check_command "rustc" "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    check_command "cargo" "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    check_command "trunk" "curl https://get.trunk.io | bash"
    check_command "cargo-ndk" "cargo install cargo-ndk"

    # Check Rust targets
    echo "🔍 Checking Rust targets..."
    for target in aarch64-linux-android aarch64-apple-ios-sim aarch64-apple-ios; do
        if rustup target list --installed | grep -q "$target"; then
            echo "✅ Rust target $target is installed."
        else
            echo "❌ Rust target $target is not installed."
            echo "💡 Install it with: rustup target add $target"
            exit 1
        fi
    done

    # Install Node.js dependencies (cached by npm)
    echo "📦 Installing Node.js dependencies..."
    npm install --loglevel=verbose

    # Run Trunk linters (cached by Trunk for unchanged files)
    echo "🧹 Running Trunk linters..."
    if [ -f .trunk/trunk.yaml ]; then
        trunk check --ci --no-fix
    else
        echo "❌ Error: .trunk/trunk.yaml not found."
        exit 1
    fi

    # Compile Rust and generate bindings (cached by cargo)
    echo "🦀 Compiling Rust and generating bindings..."
    node scripts/setup_rust_bindings.mjs --all

    # Verify generated bindings
    echo "🔍 Verifying generated bindings..."
    if [ -d modules/zk-bindings/android/src/main/jniLibs ] && [ -d modules/zk-bindings/ios/rust ]; then
        echo "✅ Bindings generated successfully."
    else
        echo "❌ Error: Generated bindings are missing."
        exit 1
    fi

    # Run Expo prebuild for Android
    echo "🤖 Running Expo prebuild for Android..."
    npx expo prebuild --platform android --no-install
    if [ -f android/gradlew ]; then
        echo "✅ Android prebuild successful."
    else
        echo "❌ Error: Android prebuild failed (gradlew not found)."
        exit 1
    fi

    # Run Expo prebuild for iOS
    echo "🍎 Running Expo prebuild for iOS..."
    npx expo prebuild --platform ios --no-install
    if [ -d ios/*.xcodeproj ]; then
        echo "✅ iOS prebuild successful."
    else
        echo "❌ Error: iOS prebuild failed (Xcode project not found)."
        exit 1
    fi

    # Update cache if all checks pass
    echo "📝 Updating cache..."
    compute_hash > "$CACHE_FILE"
    echo "$CURRENT_COMMIT" > "$LAST_COMMIT_FILE"
fi

echo "🎉 All pre-push checks passed! Proceeding with push."
exit 0
