import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function ManualEntry() {
  const [documentNumber, setDocumentNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const handleSubmit = () => {
    if (!documentNumber || !dateOfBirth || !expiryDate) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    router.push({
      pathname: "/nfc",
      params: {
        documentNo: documentNumber,
        expiryDate: expiryDate,
        birthDate: dateOfBirth,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>Enter Passport Details</Text>

        <Text style={styles.label}>Document Number</Text>
        <TextInput
          style={styles.input}
          value={documentNumber.toUpperCase()}
          onChangeText={setDocumentNumber}
          placeholder="Enter document number"
        />

        <Text style={styles.label}>Date of Birth (YYMMDD)</Text>
        <TextInput
          style={styles.input}
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          placeholder="YYMMDD"
          keyboardType="numeric"
          maxLength={6}
        />

        <Text style={styles.label}>Expiry Date (YYMMDD)</Text>
        <TextInput
          style={styles.input}
          value={expiryDate}
          onChangeText={setExpiryDate}
          placeholder="YYMMDD"
          keyboardType="numeric"
          maxLength={6}
        />

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={handleSubmit}>
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f0f0f0",
  },
  formContainer: {
    padding: 20,
    width: "100%",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 30,
  },
  input: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  label: {
    fontSize: 16,
    color: "#333",
    marginBottom: 8,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 20,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: "#FF3B30",
  },
});
