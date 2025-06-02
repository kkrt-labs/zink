// Reexport the native module. On web, it will be resolved to NfcReaderModule.web.ts
// and on native platforms to NfcReaderModule.ts
export * from "./NfcReader.types";
export { default } from "./NfcReaderModule";
