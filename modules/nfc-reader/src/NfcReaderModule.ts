import { NativeModule, requireNativeModule } from "expo";

declare class NfcReaderModule extends NativeModule {
  scan(
    documentNo: string,
    dateOfBirth: string,
    dateOfExpiry: string,
  ): Promise<string>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<NfcReaderModule>("NfcReader");
