import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"], // Build for commonJS and ESmodules
  dts: true, // Generate declaration file (.d.ts)
  splitting: false, // Disable code splitting for a single-file library
  sourcemap: true, // Generate sourcemaps for debugging
  clean: true, // Clean the dist folder before building
  minify: true, // Minify the output for production
  treeshake: true, // Remove unused code
});
