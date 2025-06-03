import NfcReader from "@modules/nfc-reader/src";
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PassportData, PassportDataView } from "../components/passport-data";

export default function NfcScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    documentNo?: string;
    birthDate?: string;
    expiryDate?: string;
  }>();

  // Validate MRZ data
  const isMrzValid = !!(
    params.documentNo &&
    params.birthDate &&
    params.expiryDate
  );

  const [passportData, setPassportData] = React.useState<PassportData | null>(
    null,
  );

  // Mutation for starting NFC reading
  const startReading = useMutation({
    mutationFn: async () => {
      if (!isMrzValid) {
        throw new Error("Cannot start reading: MRZ data is missing");
      }
      return NfcReader.scan(
        params.documentNo!,
        params.birthDate!,
        params.expiryDate!,
      ) as Promise<string>;
    },
    onSuccess: (data) => {
      const parsedData = JSON.parse(data) as PassportData;
      setPassportData(parsedData);
    },
    onError: (error: Error) => {
      if (!error.message.toLowerCase().includes("cancel")) {
        Alert.alert("NFC Read Failed", error.message);
      }
    },
  });

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
        <View style={styles.paramsBox}>
          <Text style={styles.paramsTitle}>MRZ Data:</Text>
          <Text style={styles.paramsText}>
            Document No: {params.documentNo}
          </Text>
          <Text style={styles.paramsText}>Birth Date: {params.birthDate}</Text>
          <Text style={styles.paramsText}>
            Expiry Date: {params.expiryDate}
          </Text>
        </View>

        {passportData ? (
          <View style={styles.passportDataContainer}>
            <PassportDataView data={passportData} />
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => startReading.mutate()}
            style={[
              styles.button,
              startReading.isPending && styles.buttonDisabled,
            ]}
            disabled={startReading.isPending}
          >
            <Text style={styles.buttonText}>
              {startReading.isPending ? "Scanning..." : "Scan Passport"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
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
  paramsBox: {
    alignItems: "flex-start",
    width: "100%",
    marginBottom: 20,
  },
  paramsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  paramsText: {
    fontSize: 16,
    marginBottom: 5,
  },
  passportDataContainer: {
    flex: 1,
    width: "100%",
  },
});
