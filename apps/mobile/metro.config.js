const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// The monorepo root (two levels up from apps/mobile)
const monorepoRoot = path.resolve(__dirname, "../..");

const config = getDefaultConfig(__dirname);

// Let Metro resolve packages from both the app folder and the monorepo root
config.watchFolders = [monorepoRoot];

// On Windows, the React Native Gradle plugin passes --entry-file as a path
// relative to the app root (apps/mobile). Metro's _resolveRelativePath resolves
// it from unstable_serverRoot, which expo/metro-config defaults to the monorepo
// root. This causes the relative path to resolve above the monorepo and fail.
// Resetting unstable_serverRoot to __dirname (apps/mobile) fixes the issue.
config.server = {
  ...config.server,
  unstable_serverRoot: __dirname,
};

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Redirect react-native-maps to a no-op stub on web (it uses native-only internals)
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-maps") {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "src/mocks/react-native-maps.js"),
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
