const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

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

// unstable_serverRoot is set to __dirname (apps/mobile) for the Android build,
// which causes Metro's entry-point resolution to miss packages that only exist
// in the monorepo root node_modules. Dynamically alias every package from the
// root so Metro can always find them regardless of how the entry is resolved.
const rootNodeModulesDir = path.resolve(monorepoRoot, "node_modules");
const rootPackageAliases = fs.readdirSync(rootNodeModulesDir).reduce((acc, name) => {
  if (name.startsWith(".")) return acc;
  const pkgPath = path.join(rootNodeModulesDir, name);
  if (name.startsWith("@")) {
    try {
      fs.readdirSync(pkgPath).forEach((scoped) => {
        acc[`${name}/${scoped}`] = path.join(pkgPath, scoped);
      });
    } catch (_) {}
  } else {
    acc[name] = pkgPath;
  }
  return acc;
}, {});

config.resolver.extraNodeModules = {
  ...rootPackageAliases,
  ...config.resolver.extraNodeModules,
};

// Redirect react-native-maps to a no-op stub on web (it uses native-only internals)
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-maps") {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "src/mocks/react-native-maps.js"),
    };
  }

  // When unstable_serverRoot is apps/mobile, Metro converts the package.json
  // "main" entry (e.g. "expo-router/entry") into a relative path
  // "./node_modules/expo-router/entry". This bypasses extraNodeModules.
  // Strip the prefix so the bare specifier is resolved via nodeModulesPaths.
  if (moduleName.startsWith("./node_modules/")) {
    const bareName = moduleName.slice("./node_modules/".length);
    return context.resolveRequest(context, bareName, platform);
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
