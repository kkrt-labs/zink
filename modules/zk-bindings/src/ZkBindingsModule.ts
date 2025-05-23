import { NativeModule, requireNativeModule } from "expo";
import { NoirProofWrapper, ZkBindingsModuleEvents } from "./ZkBindings.types";


declare class ZkBindingsModule extends NativeModule<ZkBindingsModuleEvents> {
  PI: number;
  setValueAsync(value: string): Promise<void>;
  generateAndVerifyProof(
    circuitJsonStr: string,
    inputJsonStr: string,
  ): Promise<void>;
  generateProof(
    circuitJsonStr: string,
    inputJsonStr: string,
  ): Promise<NoirProofWrapper>;
  verifyProof(
    circuitJsonStr: string,
    proof: NoirProofWrapper,
  ): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ZkBindingsModule>("ZkBindings");
