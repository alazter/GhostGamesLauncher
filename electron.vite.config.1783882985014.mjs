// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react-swc";
import svgr from "vite-plugin-svgr";
import path from "path";
var __electron_vite_injected_dirname = "C:\\Users\\alazt\\Documents\\GitHub\\Projetos\\HeroicGamesLauncher";
var srcAliases = ["backend", "frontend", "common"].map((aliasName) => ({
  find: aliasName,
  replacement: path.join(__electron_vite_injected_dirname, "src", aliasName)
}));
var dependenciesToNotExternalize = [
  "@xhmikosr/decompress",
  "@xhmikosr/decompress-targz",
  "@xhmikosr/decompress-unzip"
];
var vite_plugin_react_dev_tools = {
  name: "react-dev-tools-replace",
  transformIndexHtml: {
    handler: (html) => html.replace(
      "<!-- REACT_DEVTOOLS_SCRIPT -->",
      '<script src="http://localhost:8097"></script>'
    )
  }
};
var electron_vite_config_default = defineConfig(({ mode }) => ({
  main: {
    build: {
      rollupOptions: {
        input: "src/backend/main.ts"
      },
      outDir: "build/main",
      minify: true,
      sourcemap: mode === "development" ? "inline" : false
    },
    resolve: { alias: srcAliases },
    plugins: [externalizeDepsPlugin({ exclude: dependenciesToNotExternalize })]
  },
  preload: {
    build: {
      rollupOptions: {
        input: "src/preload/index.ts"
      },
      outDir: "build/preload",
      minify: true,
      sourcemap: mode === "development" ? "inline" : false
    },
    resolve: { alias: srcAliases },
    plugins: [externalizeDepsPlugin({ exclude: dependenciesToNotExternalize })]
  },
  renderer: {
    root: ".",
    build: {
      rollupOptions: {
        input: path.resolve("index.html")
      },
      target: "esnext",
      outDir: "build",
      emptyOutDir: false,
      minify: true,
      sourcemap: mode === "development" ? "inline" : false
    },
    resolve: { alias: srcAliases },
    plugins: [
      react(),
      svgr(),
      mode !== "production" && vite_plugin_react_dev_tools
    ]
  }
}));
export {
  electron_vite_config_default as default
};
