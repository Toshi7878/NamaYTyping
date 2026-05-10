import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";
import pkg from "./package.json";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    monkey({
      entry: "src/main.tsx",
      userscript: {
        name: "namaYTyping",
        namespace: "https://greasyfork.org/users/302934",
        version: pkg.version,
        description:
          "変換ありタイピングで配信プラットフォームのチャットに接続し対戦を可能にするスクリプト",
        match: ["https://ytyping.net/*"],
        grant: ["GM_xmlhttpRequest", "unsafeWindow"],
        connect: [
          "www.youtube.com",
          "live.nicovideo.jp",
          "live2.nicovideo.jp",
          "*.nicovideo.jp",
          "*.nmsg.nicovideo.jp",
        ],
        license: "MIT",
      },
    }),
  ],
});
