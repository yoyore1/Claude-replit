// Metro config for a pnpm monorepo: watch the workspace root so symlinked
// workspace packages (@cr/*) are transpiled as source, and let Metro resolve
// from both the app and the hoisted root node_modules.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Force a SINGLE copy of React / React Native. In a pnpm monorepo the workspace
// package @cr/tap-edit-runtime (peer deps) resolves its own symlinked react,
// while the app resolves react from the hoisted root node_modules — two copies.
// On web, Vite dedupes automatically; Metro does not, so hooks crash on device
// with "Invalid hook call / Cannot read property 'useRef' of null". Pin both to
// the app's copy. Vite is unaffected (it has its own resolution).
const SINGLETONS = ["react", "react-dom", "react-native"];
const singletonRoot = {};
for (const name of SINGLETONS) {
  try {
    singletonRoot[name] = path.dirname(
      require.resolve(name + "/package.json", { paths: [projectRoot] }),
    );
  } catch {
    /* not installed (e.g. react-dom on native) — skip */
  }
}

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // 1) Redirect react / react-native (and their subpaths) to the single copy.
  for (const name of SINGLETONS) {
    const root = singletonRoot[name];
    if (!root) continue;
    if (moduleName === name) {
      return context.resolveRequest(context, root, platform);
    }
    if (moduleName.startsWith(name + "/")) {
      return context.resolveRequest(
        context,
        path.join(root, moduleName.slice(name.length + 1)),
        platform,
      );
    }
  }

  // 2) Map NodeNext-style ".js" relative imports (e.g. "./fiber.js") onto the
  // ".ts"/".tsx" source our @cr/* packages actually ship.
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    try {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    } catch {
      /* fall through to the original specifier */
    }
  }

  return (defaultResolveRequest ?? context.resolveRequest)(
    context,
    moduleName,
    platform,
  );
};

module.exports = config;
