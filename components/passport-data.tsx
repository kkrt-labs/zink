import * as React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

// Passport data type definition
export type PassportData = {
  documentType: string;
  documentSubType: string;
  documentNumber: string;
  issuingAuthority: string;
  documentExpiryDate: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  lastName: string;
  firstName: string;
  passportMRZ: string;
  placeOfBirth: string;
  residenceAddress: string;
  phoneNumber: string;
  personalNumber: string;
  LDSVersion: string;
  dataGroupsPresent: string[];
  documentSigningCertificate: {
    fingerprint: string;
    issuerName: string;
    subjectName: string;
    serialNumber: string;
    signatureAlgorithm: string;
    publicKeyAlgorithm: string;
    notBefore: string;
    notAfter: string;
  };
  countrySigningCertificate: {
    fingerprint: string;
    issuerName: string;
    subjectName: string;
    serialNumber: string;
    signatureAlgorithm: string;
    publicKeyAlgorithm: string;
    notBefore: string;
    notAfter: string;
  };
};

interface PassportDataProps {
  data: PassportData;
}

export const PassportDataView: React.FC<PassportDataProps> = ({ data }) => {
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
});
