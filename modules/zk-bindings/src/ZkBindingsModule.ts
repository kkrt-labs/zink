import { NativeModule, requireNativeModule } from 'expo-modules-core';

import { ZkBindingsModuleEvents } from './ZkBindings.types';

declare class ZkBindingsModule extends NativeModule<ZkBindingsModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
  generateRandomNumberAsync(): Promise<number>;
}

const NativeModuleInstance = requireNativeModule<ZkBindingsModule>('ZkBindings');

export default NativeModuleInstance
