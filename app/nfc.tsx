import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import NfcPassportReader from "react-native-nfc-passport-reader";

export default function NfcScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    documentNo?: string;
    expiryDate?: string;
    birthDate?: string;
  }>();

  // Validate MRZ data
  const isMrzValid = !!(
    params.documentNo &&
    params.expiryDate &&
    params.birthDate
  );

  // State for scanning
  const [isScanning, setIsScanning] = React.useState(false);

  // Query for NFC status
  const { data: nfcStatus } = useQuery({
    queryKey: ["nfcStatus"],
    queryFn: async () => {
      const supported = await NfcPassportReader.isNfcSupported();
      if (!supported) {
        Alert.alert("NFC Not Supported", "This device does not support NFC.", [
          { text: "OK", onPress: () => router.push("/") },
        ]);
        throw new Error("NFC not supported");
      }
      const enabled = await NfcPassportReader.isNfcEnabled();
      if (!enabled) {
        Alert.alert(
          "NFC Disabled",
          "Please enable NFC in your device settings.",
          Platform.OS === "android"
            ? [
                {
                  text: "Open Settings",
                  onPress: async () => {
                    await NfcPassportReader.openNfcSettings();
                  },
                },
                { text: "Cancel", style: "cancel" },
              ]
            : [{ text: "OK" }],
        );
      }
      return { supported, enabled };
    },
    enabled: isMrzValid,
  });

  // Mutation for starting NFC reading
  const startReading = useMutation({
    mutationFn: async () => {
      if (!isMrzValid) {
        throw new Error("Cannot start reading: MRZ data is missing");
      }
      return NfcPassportReader.startReading({
        bacKey: {
          documentNo: params.documentNo!,
          expiryDate: params.expiryDate!,
          birthDate: params.birthDate!,
        },
        includeImages: true,
      });
    },
    onMutate: () => setIsScanning(true),
    onSuccess: () => {
      setIsScanning(false);
      Alert.alert("Success", "Passport data has been read.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (error: Error) => {
      setIsScanning(false);
      if (!error.message.toLowerCase().includes("cancel")) {
        Alert.alert("NFC Read Failed", error.message);
      }
    },
  });

  // Handle cancel (Android stop or iOS dismiss)
  const handleCancel = () => {
    if (Platform.OS === "android") {
      NfcPassportReader.stopReading();
    }
    setIsScanning(false);
  };

  // Setup Android tag listener
  React.useEffect(() => {
    if (Platform.OS === "android") {
      NfcPassportReader.addOnTagDiscoveredListener(() => {
        console.log("Tag Discovered (Android)");
        setIsScanning(true);
      });
      return () => {
        NfcPassportReader.stopReading();
        NfcPassportReader.removeListeners();
      };
    }
  }, []);

  if (!isMrzValid) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.box}>
          <Text style={styles.message}>Loading MRZ data...</Text>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.box}>
        <TouchableOpacity
          onPress={() => startReading.mutate()}
          style={[
            styles.button,
            (startReading.isPending ||
              !nfcStatus?.enabled ||
              !nfcStatus?.supported) &&
              styles.buttonDisabled,
          ]}
          disabled={
            startReading.isPending ||
            !nfcStatus?.enabled ||
            !nfcStatus?.supported
          }
        >
          <Text style={styles.buttonText}>
            {startReading.isPending ? "Scanning..." : "Scan Passport"}
          </Text>
        </TouchableOpacity>
      </View>

      {isScanning && (
        <View style={styles.overlayBox}>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Scanning...{"\n"}
              {Platform.OS === "ios"
                ? "Place the top of your iPhone near the passport."
                : "Place passport against the back of your phone."}
            </Text>
            <ActivityIndicator
              size="large"
              color="#007AFF"
              style={{ marginTop: 20 }}
            />
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f0f0f0" },
  box: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  message: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    width: "80%",
  },
  buttonDisabled: { backgroundColor: "#B0C4DE" },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: { backgroundColor: "#5856D6" },
  cancelButton: { backgroundColor: "#FF3B30", marginTop: 20 },
  overlayBox: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  infoBox: {
    borderRadius: 16,
    padding: 20,
    backgroundColor: "#fff",
    width: "85%",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  infoText: {
    color: "#252526",
    textAlign: "center",
    fontSize: 18,
    fontWeight: "500",
  },
});
