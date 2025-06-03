import { router } from "expo-router";
import { Button, Text, View } from "react-native";

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
        padding: 20,
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 20 }}>
        Welcome to Zink
      </Text>
      <Button
        title="Go to Proof Generation"
        onPress={() => router.push("/proof")}
      />
      <Button
        title="Start Passport Scan"
        onPress={() => router.push("/passport-choice")}
      />
    </View>
  );
}
