import { MrzData, MrzReaderView } from "mrz-reader";
import { Alert, StyleSheet, Text, View } from "react-native";

export default function MRZScannerPage() {
  const handleMrzExtracted = ({ nativeEvent }: { nativeEvent: MrzData }) => {
    console.log("MRZ Extracted:", nativeEvent);
    // You can now process the extracted data.
    // For example, display it in an alert or navigate to another screen.
    Alert.alert(
      "MRZ Scanned",
      `Raw MRZ: ${JSON.stringify(nativeEvent, null, 2)}`,
    );
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <MrzReaderView
        style={StyleSheet.absoluteFill}
        onMrzExtracted={handleMrzExtracted}
      />
      <View style={styles.overlay}>
        <Text style={styles.overlayText}>
          Align passport MRZ within this area
        </Text>
      </View>
    </View>
  );
}

// Example styles for an overlay (optional)
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)", // Semi-transparent overlay
  },
  overlayText: {
    color: "white",
    fontSize: 18,
    textAlign: "center",
    padding: 20,
  },
});
