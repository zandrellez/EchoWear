const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// 👇 Add GLB and GLTF to asset extensions
config.resolver.assetExts.push("glb", "gltf");

module.exports = config;
