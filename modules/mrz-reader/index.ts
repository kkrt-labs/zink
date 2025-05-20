// Reexport the native module. On web, it will be resolved to MrzReaderModule.web.ts
// and on native platforms to MrzReaderModule.ts
export * from "./src/MrzReader.types";
export { default } from "./src/MrzReaderModule";
export { default as MrzReaderView } from "./src/MrzReaderView";
