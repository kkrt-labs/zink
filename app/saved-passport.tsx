import { PassportData } from "@modules/nfc-reader/src/NfcReader.types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as React from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PassportDataView } from "../components/passport-data";

export const PASSPORT_DATA_KEY = "encrypted_passport_data";

export const loadPassportDataFromStore =
  async (): Promise<PassportData | null> => {
    try {
      const serializedData = await AsyncStorage.getItem(PASSPORT_DATA_KEY);
      if (!serializedData) {
        return null;
      }
      return JSON.parse(serializedData) as PassportData;
    } catch (error) {
      console.error("Failed to load passport data:", error);
      return null;
    }
  };

export default function SavedPassportScreen() {
  const router = useRouter();

  const {
    data: passportData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["savedPassportData"],
    queryFn: loadPassportDataFromStore,
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBox}>
          <Text style={styles.message}>Loading saved passport data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !passportData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBox}>
          <Text style={styles.errorMessage}>
            {error
              ? "Error loading passport data"
              : "No saved passport data found"}
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Saved Passport Data</Text>
      </View>
      <PassportDataView data={passportData} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f0f0f0",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
  },
  backButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    gap: 20,
  },
  message: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 18,
    color: "#333",
    textAlign: "center",
  },
});
