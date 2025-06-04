// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.resolver.nodeModulesPaths = [
  ...defaultConfig.resolver.nodeModulesPaths,
  path.resolve(__dirname, "modules"),
];

defaultConfig.resolver.assetExts.push("pem");

module.exports = defaultConfig;
