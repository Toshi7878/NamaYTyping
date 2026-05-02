import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";

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
				name: "NamaYTyping YouTube",
				namespace: "https://greasyfork.org/users/302934",
				version: "1.0.0",
				description:
					"YTypingの変換ありタイピングにYouTube Liveチャットから参加できる拡張機能",
				match: ["https://ytyping.net/*"],
				grant: ["GM_xmlhttpRequest", "unsafeWindow"],
				connect: ["www.youtube.com"],
				license: "MIT",
				downloadURL:
					"https://update.greasyfork.org/scripts/576187/NamaYTyping%20YouTube.user.js",
				updateURL:
					"https://update.greasyfork.org/scripts/576187/NamaYTyping%20YouTube.meta.js",
			},
		}),
	],
});
