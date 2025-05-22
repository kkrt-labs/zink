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
  safeArea: { flex: 1, backgroundColor: "#f0f0f0" },
  message: { fontSize: 16, color: "#333", textAlign: "center", margin: 10 },
  overlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  overlayText: {
    color: "white",
    fontSize: 18,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 8,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    width: "80%",
    margin: 5,
  },
  buttonText: { color: "#fff", fontSize: 16 },
  cancelButton: { backgroundColor: "#FF3B30" },
});
