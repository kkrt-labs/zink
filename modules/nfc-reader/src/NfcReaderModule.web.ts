import { NativeModule, registerWebModule } from "expo";

class NfcReaderModule extends NativeModule {}

export default registerWebModule(NfcReaderModule, "NfcReaderModule");
