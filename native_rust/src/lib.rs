uniffi::setup_scaffolding!();

use acvm::FieldElement;
use bn254_blackbox_solver::Bn254BlackBoxSolver;
use nargo::{foreign_calls::DefaultForeignCallBuilder, ops::execute_program};
use noir_r1cs::{NoirProof, NoirProofScheme};
use noirc_abi::{
    InputMap, MAIN_RETURN_NAME,
    input_parser::{Format, InputValue},
};
use noirc_artifacts::program::ProgramArtifact;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Errors to wrap ProveKit errors for UniFFI.
#[derive(Debug, thiserror::Error, uniffi::Error)]
pub enum NoirProverError {
    /// Error when instantiating a Noir prover with a given compiled Noir circuit.
    #[error("Failed to create prover: {0}")]
    CreationError(String),
    /// Something whent wrong during the ProveKit proof generation.
    #[error("Failed to generate proof: {0}")]
    ProofGenerationError(String),
    /// The verification of the given Noir proof failed.
    #[error("Failed to verify proof: {0}")]
    VerificationError(String),
}

/// A serializable wrapper for NoirProof that can be safely passed across the FFI boundary
#[derive(Serialize, Deserialize, uniffi::Record)]
pub struct NoirProofWrapper {
    /// The serialized proof data
    proof_data: String,
}

impl NoirProofWrapper {
    /// Serialize a given NoirProof to a string.
    fn new(proof: NoirProof) -> Self {
        let proof_data = serde_json::to_string(&proof).expect("Failed to serialize NoirProof");
        Self { proof_data }
    }

    /// Deserialize a NoirProof.
    fn into_proof(&self) -> Result<NoirProof, NoirProverError> {
        // Deserialize the proof from the string
        serde_json::from_str(&self.proof_data)
            .map_err(|e| NoirProverError::VerificationError(e.to_string()))
    }
}

/// Object to generate a proof of a Noir circuit with ProveKit.
#[derive(Serialize, Deserialize, uniffi::Object)]
pub struct NoirProver {
    proof_scheme: NoirProofScheme,
    program: ProgramArtifact,
}

impl NoirProver {
    /// Generate the proof scheme of the given Noir circuit.
    /// * `circuit_json_str` - The compiled Noir circuit JSON as a string.
    pub fn from_circuit(circuit_json_str: &String) -> Result<Self, NoirProverError> {
        let program = {
            serde_json::from_str(&circuit_json_str.to_string())
                .map_err(|e| NoirProverError::CreationError(e.to_string()))?
        };

        let proof_scheme = NoirProofScheme::from_program(&program)
            .map_err(|e| NoirProverError::CreationError(e.to_string()))?;
        Ok(Self { proof_scheme, program })
    }

    /// Generates a proof of the loaded Noir circuit, for the given inputs.
    /// * `input_json_str` - The circuit inputs in a JSON format as a string.
    pub fn prove(&self, input_json_str: &String) -> Result<NoirProofWrapper, NoirProverError> {
        let (input_map, _expected_return_value) = self.generate_witness_map(input_json_str)?;
        let initial_witness = self
            .program
            .abi
            .encode(&input_map, None)
            .map_err(|e| NoirProverError::CreationError(e.to_string()))?;
        let mut foreign_call_executor =
            DefaultForeignCallBuilder::default().with_mocks(false).build::<FieldElement>();
        let blackbox_solver = Bn254BlackBoxSolver(false);
        let mut witness_stack = execute_program(
            &self.program.bytecode,
            initial_witness,
            &blackbox_solver,
            &mut foreign_call_executor,
        )
        .map_err(|e| NoirProverError::ProofGenerationError(e.to_string()))?;
        let witness_map = witness_stack.pop().unwrap().witness;

        let proof = self
            .proof_scheme
            .prove(&witness_map)
            .map_err(|e| NoirProverError::ProofGenerationError(e.to_string()))?;
        Ok(NoirProofWrapper::new(proof))
    }

    /// Generate the ACIR witness map expected by the `ProveKit::prove` function from the input JSON
    /// string.
    /// * `input_json_str` - The circuit inputs in a JSON format as a string.
    fn generate_witness_map(
        &self,
        input_json_str: &String,
    ) -> Result<(InputMap, Option<InputValue>), NoirProverError> {
        let has_params = !self.program.abi.parameters.is_empty();
        let has_return = self.program.abi.return_type.is_some();
        let has_input = !input_json_str.is_empty();

        if !has_params && !has_return {
            return Ok((BTreeMap::new(), None));
        }
        if !has_params && !has_input {
            return Ok((BTreeMap::new(), None));
        }
        if has_params && !has_input {
            return Err(NoirProverError::CreationError(String::from(
                "The ABI expects parameters but no input were provided.",
            )));
        }

        let mut inputs = Format::Json
            .parse(&input_json_str, &self.program.abi)
            .map_err(|e| NoirProverError::CreationError(e.to_string()))?;
        let return_value = inputs.remove(MAIN_RETURN_NAME);

        Ok((inputs, return_value))
    }

    /// Verify a given Noir proof for the current circuit proof scheme.
    /// * `proof` - The ProveKit's Spartan WHIR Noir proof to be verified.
    pub fn verify(&self, proof: &NoirProofWrapper) -> Result<(), NoirProverError> {
        let proof = proof.into_proof()?;
        self.proof_scheme
            .verify(&proof)
            .map_err(|e| NoirProverError::VerificationError(e.to_string()))?;
        Ok(())
    }
}

/// Generate a Noir proof of the given Noir circuit with the provided inputs.
/// * `circuit_json_str` - The compiled Noir circuit JSON as a string.
/// * `input_json_str` - The circuit inputs in a JSON format as a string.
#[uniffi::export]
pub fn generate_proof(
    circuit_json_str: &String,
    input_json_str: &String,
) -> Result<NoirProofWrapper, NoirProverError> {
    let prover = NoirProver::from_circuit(circuit_json_str)?;
    prover.prove(input_json_str)
}

/// Verify a Noir proof, given the circuit to verify against.
/// * `circuit_json_str` - The compiled Noir circuit JSON as a string.
/// * `proof` - The ProveKit's Spartan WHIR Noir proof to be verified.
#[uniffi::export]
pub fn verify_proof(
    circuit_json_str: &String,
    proof: &NoirProofWrapper,
) -> Result<(), NoirProverError> {
    let prover = NoirProver::from_circuit(circuit_json_str)?;
    prover.verify(proof)?;
    Ok(())
}

/// Generate a Noir proof of the given circuit with the provided inputs, and verify it.
/// * `circuit_json_str` - The compiled Noir circuit JSON as a string.
/// * `input_json_str` - The circuit inputs in a JSON format as a string.
#[uniffi::export]
pub fn generate_and_verify_proof(
    circuit_json_str: &String,
    input_json_str: &String,
) -> Result<(), NoirProverError> {
    let prover = NoirProver::from_circuit(circuit_json_str)?;
    let proof = prover.prove(input_json_str)?;
    prover.verify(&proof)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs::File, path::Path};

    #[test]
    fn test_generate_and_verify_proof() {
        let circuit_path =
            String::from("/Users/simon/kkrt/noir/zink/assets/noir/poseidon-example.json");
        let file = File::open(Path::new(&circuit_path)).expect("Failed opening circuit.json");
        let program_artifact: ProgramArtifact =
            serde_json::from_reader(file).expect("Failed reading JSON circuit");
        let circuit_json_str =
            serde_json::to_string(&program_artifact).expect("Failed to stringify ProgramArtifact");

        let input_json_str = String::from(
            r#"{"plains":[1,2],"a":1,"b":2,"c":3,"d":5,"x":0,"result":"0x0e90c132311e864e0c8bca37976f28579a2dd9436bbc11326e21ec7c00cea5b2"}"#,
        );

        generate_and_verify_proof(&circuit_json_str, &input_json_str)
            .expect("Failed to verify proof");
    }

    #[test]
    fn test_generate_proof() {
        let circuit_path =
            String::from("/Users/simon/kkrt/noir/zink/assets/noir/poseidon-example.json");
        let file = File::open(Path::new(&circuit_path)).expect("Failed opening circuit.json");
        let program_artifact: ProgramArtifact =
            serde_json::from_reader(file).expect("Failed reading JSON circuit");
        let circuit_json_str =
            serde_json::to_string(&program_artifact).expect("Failed to stringify ProgramArtifact");

        let input_json_str = String::from(
            r#"{"plains":[1,2],"a":1,"b":2,"c":3,"d":5,"x":0,"result":"0x0e90c132311e864e0c8bca37976f28579a2dd9436bbc11326e21ec7c00cea5b2"}"#,
        );

        let proof = generate_proof(&circuit_json_str, &input_json_str).unwrap();
        verify_proof(&circuit_json_str, &proof).expect("Failed to verify proof");
    }

    #[test]
    fn test_proof_workflow() {
        let circuit_path =
            String::from("/Users/simon/kkrt/noir/zink/assets/noir/poseidon-example.json");
        let file = File::open(Path::new(&circuit_path)).expect("Failed opening circuit.json");
        let program_artifact: ProgramArtifact =
            serde_json::from_reader(file).expect("Failed reading JSON circuit");
        let circuit_json_str =
            serde_json::to_string(&program_artifact).expect("Failed to stringify ProgramArtifact");

        let input_json_str = String::from(
            r#"{"plains":[1,2],"a":1,"b":2,"c":3,"d":5,"x":0,"result":"0x0e90c132311e864e0c8bca37976f28579a2dd9436bbc11326e21ec7c00cea5b2"}"#,
        );

        let prover = NoirProver::from_circuit(&circuit_json_str).expect("Failed to create prover");
        let proof = prover.prove(&input_json_str).expect("Failed to generate proof");
        prover.verify(&proof).expect("Failed to verify proof");
    }
}
