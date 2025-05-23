import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Pressable, ScrollView, Text, View } from "react-native";
import ZkBindings from "zk-bindings";
import { NoirProofWrapper } from "zk-bindings/src/ZkBindings.types";

const noirCircuit = require("../assets/noir/poseidon-example.json");

const defaultInputs = {
  plains: [1, 2],
  a: 1,
  b: 2,
  c: 3,
  d: 5,
  x: 0,
  result: "0x0e90c132311e864e0c8bca37976f28579a2dd9436bbc11326e21ec7c00cea5b2"
};

type MutationType = 'generate' | 'verify' | 'generateAndVerify';

export default function ProofPage() {
  const [isProofExpanded, setIsProofExpanded] = useState(false);
  const [lastMutation, setLastMutation] = useState<MutationType | null>(null);

  // Mutation for generating proof
  const generateProofMutation = useMutation({
    mutationFn: async () => {
      return ZkBindings.generateProof(
        JSON.stringify(noirCircuit),
        JSON.stringify(defaultInputs)
      );
    },
  });

  // Mutation for verifying proof
  const verifyProofMutation = useMutation({
    mutationFn: async (proof: NoirProofWrapper) => {
      return ZkBindings.verifyProof(
        JSON.stringify(noirCircuit),
        proof
      );
    },
  });

  // Mutation for generating and verifying proof
  const generateAndVerifyMutation = useMutation({
    mutationFn: async () => {
      return ZkBindings.generateAndVerifyProof(
        JSON.stringify(noirCircuit),
        JSON.stringify(defaultInputs)
      );
    },
  });

  const formatProof = (proof: NoirProofWrapper) => {
    try {
      const proofData = JSON.parse(proof.proofData);
      return JSON.stringify(proofData, null, 2);
    } catch (error) {
      console.log(error);
      return proof.proofData;
    }
  };

  const getStatusMessage = () => {
    if (!lastMutation) return "";

    switch (lastMutation) {
      case 'generate':
        if (generateProofMutation.isPending) return "Generating proof...";
        if (generateProofMutation.isError) return `Error: ${generateProofMutation.error.message}`;
        if (generateProofMutation.isSuccess) return "Proof generated successfully!";
        break;
      case 'verify':
        if (verifyProofMutation.isPending) return "Verifying proof...";
        if (verifyProofMutation.isError) return `Error: ${verifyProofMutation.error.message}`;
        if (verifyProofMutation.isSuccess) return "Proof verified successfully!";
        break;
      case 'generateAndVerify':
        if (generateAndVerifyMutation.isPending) return "Generating and verifying proof...";
        if (generateAndVerifyMutation.isError) return `Error: ${generateAndVerifyMutation.error.message}`;
        if (generateAndVerifyMutation.isSuccess) return "Proof generated and verified successfully!";
        break;
    }
    return "";
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
        onPress={() => {
          setLastMutation('generate');
          generateProofMutation.mutate();
        }}
        disabled={generateProofMutation.isPending}
      />
      <Button
        title="Verify Proof"
        onPress={() => {
          if (generateProofMutation.data) {
            setLastMutation('verify');
            verifyProofMutation.mutate(generateProofMutation.data);
          }
        }}
        disabled={!generateProofMutation.data || verifyProofMutation.isPending}
      />
      <Button
        title="Generate and Verify Proof"
        onPress={() => {
          setLastMutation('generateAndVerify');
          generateAndVerifyMutation.mutate();
        }}
        disabled={generateAndVerifyMutation.isPending}
      />

      {getStatusMessage() ? (
        <Text style={{ marginTop: 20, textAlign: "center" }}>
          {getStatusMessage()}
        </Text>
      ) : null}

      {generateProofMutation.data ? (
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
                {formatProof(generateProofMutation.data)}
              </Text>
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}
