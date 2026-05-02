import type { evaluateImeInput, WordResult } from "lyrics-ime-typing-engine";

interface YTypingIme extends EventTarget {
	getBuiltMap(): { initWordResults: WordResult[] } | null;
	evaluateImeInput(params: {
		value: string;
		currentWordIndex: number;
		wordResults: WordResult[];
	}): ReturnType<typeof evaluateImeInput>;
	addNotifications(notifications: string[]): void;
	addUserResult(result: { name: string; typeCount: number }): void;
}

interface YTyping {
	toast: {
		success(message: string): void;
		error(message: string): void;
	};
	getMapLinkMode: () => "ime" | "type";
	setMapLinkMode?(mode: "ime" | "type"): void;
}

declare global {
	interface Window {
		__ytyping_ime?: YTypingIme;
		__ytyping?: YTyping;
	}
}
