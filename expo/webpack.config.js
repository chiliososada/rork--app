const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');
const webpack = require('webpack');

module.exports = async function (env, argv) {
  // Set the correct app root for expo-router
  process.env.EXPO_ROUTER_APP_ROOT = path.resolve(__dirname, 'app');
  
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // Add support for import.meta
  if (config.module.parser) {
    config.module.parser.javascript = {
      ...config.module.parser.javascript,
      importMeta: true,
    };
  } else {
    config.module.parser = {
      javascript: {
        importMeta: true,
      },
    };
  }
  
  // Fix path aliases for TypeScript imports
  config.resolve.alias = {
    ...config.resolve.alias,
    '@': path.resolve(__dirname),
    '../../../../../../app': path.resolve(__dirname, 'app'),
  };
  
  // Add Node.js polyfills for web
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "path": require.resolve("path-browserify"),
    "fs": false,
    "os": false,
    "crypto": false,
    "util": false,
    "stream": false,
    "buffer": false,
  };
  
  // Configure DefinePlugin to provide require function
  const definePlugin = config.plugins.find(plugin => plugin.constructor.name === 'DefinePlugin');
  if (definePlugin) {
    definePlugin.definitions = {
      ...definePlugin.definitions,
      'typeof require': JSON.stringify('function'),
    };
  }
  
  // Provide global variables for web compatibility
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.DefinePlugin({
      global: 'globalThis',
      'typeof require': JSON.stringify('function'),
      require: 'globalThis.__webpack_require__ || (function() { throw new Error("require() is not available in browser"); })',
    }),
  ];
  
  // Add rule to handle require() calls in React Navigation and other modules
  config.module.rules.push({
    test: /\.js$/,
    include: [
      /node_modules\/@react-navigation/,
      /node_modules\/react-native-safe-area-context/,
      /node_modules\/react-native-screens/,
      /node_modules\/react-native-gesture-handler/,
    ],
    use: {
      loader: 'babel-loader',
      options: {
        presets: ['@babel/preset-env'],
        plugins: [
          ['@babel/plugin-transform-runtime', {
            regenerator: true,
          }],
          '@babel/plugin-transform-modules-commonjs',
        ],
      },
    },
  });
  
  return config;
};