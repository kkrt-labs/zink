import { NativeModule, requireNativeModule } from "expo";

declare class MrzReaderModule extends NativeModule {}

// This call loads the native module object from the JSI.
export default requireNativeModule<MrzReaderModule>("MrzReader");
