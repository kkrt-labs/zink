import { NativeModule, registerWebModule } from "expo";

class MrzReaderModule extends NativeModule {}

export default registerWebModule(MrzReaderModule, "MrzReaderModule");
