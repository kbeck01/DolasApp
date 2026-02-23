// https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude test files from the app bundle.
// Expo Router's require.context scans the entire app/ directory, which causes
// Metro to attempt bundling *.test.tsx files and their imports (e.g.
// @testing-library/react-native), which pull in Node-only modules that don't
// exist in the React Native runtime.
config.resolver.blockList = [
  /.*\.test\.[jt]sx?$/,
  /.*\.spec\.[jt]sx?$/,
];

module.exports = config;
