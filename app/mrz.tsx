import { useCameraPermissions } from "expo-camera"; // Import the hook
import { MrzData, MrzReaderView } from "mrz-reader";
import React from "react"; // Import React and useState
import { Alert, Button, StyleSheet, Text, View } from "react-native"; // Added Button

export default function MRZScannerPage() {
  // Use the hook from expo-camera to manage permissions
  const [permission, requestPermission] = useCameraPermissions();

  const handleMrzExtracted = ({ nativeEvent }: { nativeEvent: MrzData }) => {
    console.log("MRZ Extracted:", nativeEvent);
    Alert.alert(
      "MRZ Scanned",
      `Raw MRZ: ${JSON.stringify(nativeEvent, null, 2)}`,
    );
  };

  const handleMrzError = ({
    nativeEvent,
  }: {
    nativeEvent: { message: string };
  }) => {
    console.error("MRZ Scanner Error:", nativeEvent.message);
    // Show a more user-friendly error, or log for debugging
    Alert.alert("Scanner Error", nativeEvent.message);
  };

  // --- Permission Handling UI ---
  if (!permission) {
    // Camera permissions are still loading (initial state of the hook)
    return (
      <View style={styles.containerCenter}>
        <Text>Loading camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={styles.containerCenter}>
        <Text style={styles.message}>
          We need your permission to access the camera for MRZ scanning.
        </Text>
        <Button onPress={requestPermission} title="Grant Camera Permission" />
      </View>
    );
  }

  // --- Render MRZReaderView if permission is granted ---
  return (
    <View style={StyleSheet.absoluteFill}>
      <MrzReaderView
        style={StyleSheet.absoluteFill}
        onMrzExtracted={handleMrzExtracted}
        onError={handleMrzError} // Important to handle errors from the native view
      />
      <View style={styles.overlay}>
        <Text style={styles.overlayText}>
          Align passport MRZ within this area
        </Text>
      </View>
    </View>
  );
}

// Updated styles
const styles = StyleSheet.create({
  containerCenter: {
    // For permission loading/denied states
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20, // Add some padding
  },
  message: {
    textAlign: "center",
    fontSize: 16,
    marginBottom: 20, // Add margin below the message
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  overlayText: {
    color: "white",
    fontSize: 18,
    textAlign: "center",
    padding: 20,
  },
});
