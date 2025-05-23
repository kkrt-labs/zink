import { useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { MrzData, MrzReaderView } from "mrz-reader";
import React, { useState } from "react";
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";

export default function MRZScannerPage() {
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();
  const [hasNavigated, setHasNavigated] = useState(false);

  const handleMrzExtracted = ({ nativeEvent }: { nativeEvent: MrzData }) => {
    if (!hasNavigated) {
      setHasNavigated(true);
      router.push({
        pathname: "../nfc",
        params: {
          documentNo: nativeEvent.documentNumber,
          expiryDate: nativeEvent.expiryDate,
          birthDate: nativeEvent.dateOfBirth,
        },
      });
    }
  };

  const handleMrzError = ({
    nativeEvent,
  }: {
    nativeEvent: { message: string };
  }) => {
    Alert.alert("Error", nativeEvent.message, [
      { text: "Back", onPress: () => router.back() },
    ]);
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.message}>Camera permission needed.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <MrzReaderView
        style={StyleSheet.absoluteFill}
        onMrzExtracted={handleMrzExtracted}
        onError={handleMrzError}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  message: { fontSize: 16, color: "#333", textAlign: "center", margin: 20 },
  overlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  overlayText: {
    color: "white",
    fontSize: 18,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 8,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "80%",
    marginTop: 20,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    alignItems: "center",
    // Adjust width to fit side-by-side or remove if using space-around effectively
    // width: "45%", // Example: if you want them to take up a specific portion of the buttonContainer
    marginHorizontal: 5, // Add some horizontal margin between buttons
  },
  buttonText: { color: "#fff", fontSize: 16 },
  cancelButton: { backgroundColor: "#FF3B30" },
});
