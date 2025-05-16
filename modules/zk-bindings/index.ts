import NativeModuleInstance from './src/ZkBindingsModule';

// Reexport the native module. On web, it will be resolved to ZkBindingsModule.web.ts
// and on native platforms to ZkBindingsModule.ts
export * from './src/ZkBindings.types';
export { default } from './src/ZkBindingsModule';
export { default as ZkBindingsView } from './src/ZkBindingsView';

// Define the functions your app will import and use
export async function generateRandomNumber(): Promise<number> {
  return await NativeModuleInstance.generateRandomNumberAsync();
}
