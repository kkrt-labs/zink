// File: /Users/eliastazartes/code/kkrt-labs/zink/app/index.tsx
import React, { useState } from "react";
import {
  ActivityIndicator,
  Button,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

// Import the function from your zk-bindings module.
// The name 'zk-bindings' should match the 'name' field in 'modules/zk-bindings/package.json'
// if it exists, or how npm/yarn links the local module.
import { generateRandomNumber } from "zk-bindings";

export default function Index() {
  const [randomNumber, setRandomNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRandomNumberFromRust = async () => {
    setLoading(true);
    setError(null);
    setRandomNumber(null); // Clear previous number
    try {
      console.log(
        `[App] Calling generateRandomNumber from zk-bindings (Rust)... on ${Platform.OS}`,
      );
      const num = await generateRandomNumber();
      console.log("[App] Received from Rust:", num);
      setRandomNumber(num);
    } catch (e: any) {
      console.error("[App] Failed to call native module:", e);
      // Attempt to stringify the error for more details, as it might be complex
      let errorMessage = "An unknown error occurred";
      if (e && e.message) {
        errorMessage = e.message;
      } else {
        try {
          errorMessage = JSON.stringify(e);
        } catch (_) {
          // If stringify fails, stick to the generic message
        }
      }
      setError(errorMessage);
      setRandomNumber(null);
    } finally {
      setLoading(false);
    }
  };

  // Optional: Fetch on component mount if you want to test immediately
  // useEffect(() => {
  //   fetchRandomNumberFromRust();
  // }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rust Native Module Test</Text>
      <Text style={styles.text}>Salut Demo day!</Text>
      <View style={styles.buttonContainer}>
        <Button
          title="Get Random Number (from Rust)"
          onPress={fetchRandomNumberFromRust}
          disabled={loading}
          color="#007AFF" // iOS blue
        />
      </View>

      {loading && (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      )}

      {randomNumber !== null && (
        <Text style={styles.resultText}>Random Number: {randomNumber}</Text>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error:</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#F5FCFF",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  text: {
    fontSize: 18,
    marginVertical: 8,
    textAlign: "center",
  },
  buttonContainer: {
    marginVertical: 20,
    width: "80%",
  },
  loader: {
    marginVertical: 10,
  },
  resultText: {
    fontSize: 20,
    marginVertical: 15,
    fontWeight: "500",
    color: "#333",
  },
  errorContainer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#FFD2D2",
    borderRadius: 5,
    width: "90%",
    alignItems: "center",
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#D8000C",
  },
  errorText: {
    fontSize: 14,
    color: "#D8000C",
    textAlign: "center",
  },
});
