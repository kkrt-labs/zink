import { NativeModule, requireNativeModule } from "expo";

import { ZkBindingsModuleEvents } from "./ZkBindings.types";

declare class ZkBindingsModule extends NativeModule<ZkBindingsModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ZkBindingsModule>("ZkBindings");
