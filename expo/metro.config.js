const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for import.meta
config.resolver.unstable_enablePackageExports = true;

module.exports = config;