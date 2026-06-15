module.exports = function (api) {
  api.cache(true);

  const plugins = [];
  // Inject __tapSource only in development so tap-to-edit metadata never ships
  // to production and adds zero overhead there.
  if (process.env.NODE_ENV !== "production") {
    plugins.push([
      "@cr/babel-plugin-tapsource",
      { projectRoot: __dirname, exclude: ["ui/"] },
    ]);
  }

  return {
    presets: ["babel-preset-expo"],
    plugins,
  };
};
