const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Safely extend asset extensions
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'tflite',
  'glb',
  'gltf',
];

module.exports = config;
