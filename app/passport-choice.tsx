import { router } from "expo-router";
import { Button, StyleSheet, Text, View } from "react-native";

export default function PassportChoice() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        How would you like to enter your passport details?
      </Text>
      <View style={styles.buttonContainer}>
        <Button title="Scan Passport" onPress={() => router.push("/mrz")} />
        <Button
          title="Enter Passport Data Manually"
          onPress={() => router.push("/manual-entry")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    gap: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  buttonContainer: {
    width: "100%",
    gap: 10,
  },
});
