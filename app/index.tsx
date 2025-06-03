import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import * as React from "react";
import { Button, Text, View } from "react-native";
import { loadPassportDataFromStore } from "./saved-passport";

export default function Index() {
  const { data: savedPassportData } = useQuery({
    queryKey: ["savedPassportData"],
    queryFn: loadPassportDataFromStore,
  });

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

      <Button
        title="Load Saved Passport"
        onPress={() => router.push("/saved-passport")}
        disabled={!savedPassportData}
      />
    </View>
  );
}
