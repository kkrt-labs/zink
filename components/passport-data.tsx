import {
  PassportData,
  PassportDataProps,
} from "@modules/nfc-reader/src/NfcReader.types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Binary, SOD } from "@zkpassport/utils";
import { Buffer } from "buffer";
import { getRandomValues } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as React from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Import the shared constant and function from saved-passport
import {
  PASSPORT_DATA_KEY,
  loadPassportDataFromStore,
} from "../app/saved-passport";

// Set up minimal polyfills
global.Buffer = global.Buffer || Buffer;
global.crypto = global.crypto || { getRandomValues };

// Storage functions
// ⚠️ Because of the size of the data (roughly 4kb), we are above the 2048 bytes limit of the secure store
// It creates a risk of flakiness when saving and loading the data
// We should consider using a different storage solution, like a database or a file system
const savePassportDataToStore = async (data: PassportData): Promise<void> => {
  const serializedData = JSON.stringify(data);
  await SecureStore.setItemAsync(PASSPORT_DATA_KEY, serializedData);
};

const clearPassportDataFromStore = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(PASSPORT_DATA_KEY);
};

export const PassportDataView: React.FC<PassportDataProps> = ({ data }) => {
  const queryClient = useQueryClient();

  // Check if data is already saved
  const { data: savedData } = useQuery({
    queryKey: ["savedPassportData"],
    queryFn: loadPassportDataFromStore,
  });

  // Save data mutation
  const saveDataMutation = useMutation({
    mutationFn: () => savePassportDataToStore(data),
    onSuccess: () => {
      // Invalidate and refetch saved passport data
      queryClient.invalidateQueries({ queryKey: ["savedPassportData"] });
      Alert.alert("Success", "Passport data saved securely");
    },
    onError: (error: Error) => {
      Alert.alert("Error", `Failed to save: ${error.message}`);
    },
  });

  // Clear data mutation
  const clearDataMutation = useMutation({
    mutationFn: clearPassportDataFromStore,
    onSuccess: () => {
      // Invalidate and refetch saved passport data
      queryClient.invalidateQueries({ queryKey: ["savedPassportData"] });
      Alert.alert("Success", "Passport data cleared");
    },
    onError: (error: Error) => {
      Alert.alert("Error", `Failed to clear: ${error.message}`);
    },
  });

  const isSaved = savedData?.documentNumber === data.documentNumber;

  const sodFromBase64 = data.sod
    ? SOD.fromDER(Binary.fromBase64(data.sod))
    : null;
  const dg1FromBase64 = data.dg1 ? Binary.fromBase64(data.dg1) : null;

  const renderCertificateInfo = (
    cert: PassportData["documentSigningCertificate"],
    title: string,
  ) => (
    <View style={styles.certificateBox}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {Object.entries(cert).map(([key, value]) => (
        <View key={key} style={styles.dataRow}>
          <Text style={styles.label}>{key}:</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <ScrollView style={styles.scrollView}>
      {/* Data Storage Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Storage</Text>
      </View>

      {/* Personal Information Section */}
      <View style={styles.dataContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.dataRow}>
            <Text style={styles.label}>Name:</Text>
            <Text
              style={styles.value}
            >{`${data.firstName} ${data.lastName}`}</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.label}>Date of Birth:</Text>
            <Text style={styles.value}>{data.dateOfBirth}</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.label}>Gender:</Text>
            <Text style={styles.value}>{data.gender}</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.label}>Nationality:</Text>
            <Text style={styles.value}>{data.nationality}</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.label}>Place of Birth:</Text>
            <Text style={styles.value}>{data.placeOfBirth}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Document Information</Text>
          <View style={styles.dataRow}>
            <Text style={styles.label}>Document Type:</Text>
            <Text style={styles.value}>{data.documentType}</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.label}>Document Number:</Text>
            <Text style={styles.value}>{data.documentNumber}</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.label}>Issuing Authority:</Text>
            <Text style={styles.value}>{data.issuingAuthority}</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.label}>Expiry Date:</Text>
            <Text style={styles.value}>{data.documentExpiryDate}</Text>
          </View>
        </View>

        {data.documentSigningCertificate &&
          renderCertificateInfo(
            data.documentSigningCertificate,
            "Document Signing Certificate",
          )}
        {data.countrySigningCertificate &&
          renderCertificateInfo(
            data.countrySigningCertificate,
            "Country Signing Certificate",
          )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SOD Digest Algorithms</Text>
        <Text style={styles.value}>
          {sodFromBase64?.digestAlgorithms.join(", ")}
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DG1</Text>
        <Text style={styles.value}>{dg1FromBase64?.toBase64()}</Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.saveButton, isSaved && styles.savedButton]}
          onPress={() => saveDataMutation.mutate()}
          disabled={saveDataMutation.isPending}
        >
          <Text style={styles.saveButtonText}>
            {saveDataMutation.isPending
              ? "Saving..."
              : isSaved
                ? "✓ Saved Securely"
                : "Save to Secure Store"}
          </Text>
        </TouchableOpacity>

        {savedData && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => clearDataMutation.mutate()}
            disabled={clearDataMutation.isPending}
          >
            <Text style={styles.clearButtonText}>
              {clearDataMutation.isPending ? "Clearing..." : "Clear Saved Data"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    width: "100%",
  },
  dataContainer: {
    padding: 16,
    gap: 16,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#007AFF",
  },
  dataRow: {
    flexDirection: "row",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    width: "40%",
  },
  value: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  certificateBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  saveButton: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    flex: 1,
  },
  savedButton: {
    backgroundColor: "#34C759",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  clearButton: {
    backgroundColor: "#FF3B30",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    flex: 1,
  },
  clearButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
