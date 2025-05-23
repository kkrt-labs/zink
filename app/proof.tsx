import { useState } from "react";
import { Button, Pressable, ScrollView, Text, View } from "react-native";
import ZkBindings from "zk-bindings";
import { NoirProofWrapper } from "zk-bindings/src/ZkBindings.types";

const noirCircuit = require("../assets/noir/poseidon-example.json");

export default function ProofPage() {
  const [proofResult, setProofResult] = useState<string>("");
  const [proof, setProof] = useState<NoirProofWrapper | null>(null);
  const [isProofExpanded, setIsProofExpanded] = useState(false);

  const handleProofGeneration = async () => {
    try {
      const inputs = {
        plains: [1,2],
        a: 1,
        b: 2,
        c: 3,
        d: 5,
        x: 0,
        result: "0x0e90c132311e864e0c8bca37976f28579a2dd9436bbc11326e21ec7c00cea5b2"
      };

      // Generate the proof
      const generatedProof = await ZkBindings.generateProof(
        JSON.stringify(noirCircuit),
        JSON.stringify(inputs)
      );
      setProof(generatedProof);
      setProofResult("Proof generated successfully!");
    } catch (error: any) {
      setProofResult(`Error: ${error.message || "Unknown error occurred"}`);
    }
  };

  const handleProofVerification = async () => {
    if (!proof) {
      setProofResult("No proof available to verify. Generate a proof first!");
      return;
    }

    try {
      await ZkBindings.verifyProof(
        JSON.stringify(noirCircuit),
        proof
      );
      setProofResult("Proof verified successfully!");
    } catch (error: any) {
      setProofResult(`Error: ${error.message || "Unknown error occurred"}`);
    }
  };

  const handleGenerateAndVerify = async () => {
    try {
      const inputs = {
        plains: [1,2],
        a: 1,
        b: 2,
        c: 3,
        d: 5,
        x: 0,
        result: "0x0e90c132311e864e0c8bca37976f28579a2dd9436bbc11326e21ec7c00cea5b2"
      };

      await ZkBindings.generateAndVerifyProof(
        JSON.stringify(noirCircuit),
        JSON.stringify(inputs)
      );
      setProofResult("Proof generated and verified successfully!");
    } catch (error: any) {
      setProofResult(`Error: ${error.message || "Unknown error occurred"}`);
    }
  };

  const formatProof = (proof: NoirProofWrapper) => {
    try {
      // First parse the proof_data string into an object
      const proofData = JSON.parse(proof.proofData);
      // Then stringify it with proper formatting
      return JSON.stringify(proofData, null, 2);
    } catch (error) {
      // If parsing fails, return the original string
      console.log(error)
      return proof.proofData;
    }
  };

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
      <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 20 }}>Proof Generation & Verification</Text>
      <Button
        title="Generate Proof"
        onPress={handleProofGeneration}
      />
      <Button
        title="Verify Proof"
        onPress={handleProofVerification}
      />
      <Button
        title="Generate and Verify Proof"
        onPress={handleGenerateAndVerify}
      />
      {proofResult ? (
        <Text style={{ marginTop: 20, textAlign: "center" }}>
          {proofResult}
        </Text>
      ) : null}
      {proof ? (
        <View style={{ width: "100%", marginTop: 20 }}>
          <Pressable
            onPress={() => setIsProofExpanded(!isProofExpanded)}
            style={{
              backgroundColor: "#f0f0f0",
              padding: 10,
              borderRadius: 5,
              marginBottom: 5,
            }}
          >
            <Text style={{ textAlign: "center", fontWeight: "bold" }}>
              {isProofExpanded ? "Hide Proof" : "Show Proof"}
            </Text>
          </Pressable>
          {isProofExpanded && (
            <ScrollView
              style={{
                backgroundColor: "#f8f8f8",
                padding: 10,
                borderRadius: 5,
                maxHeight: 300,
              }}
            >
              <Text style={{ fontFamily: "monospace" }}>
                {formatProof(proof)}
              </Text>
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}
