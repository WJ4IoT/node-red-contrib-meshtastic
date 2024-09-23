import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [],
  build: {
    outDir: "./dist",
    lib: {
      entry: [
        resolve(__dirname, "./src/decode.ts"),
        resolve(__dirname, "./src/decrypt.ts"),
        resolve(__dirname, "./src/encode.ts"),
      ],
    },
    target: "esnext",
    rollupOptions: {
      external: ["crypto"],
    },
  },
});
