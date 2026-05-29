const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Treat .yaml / .yml as bundled assets so they can be required and read
// at runtime through expo-asset + expo-file-system.
config.resolver.assetExts.push("yaml", "yml");

module.exports = config;
