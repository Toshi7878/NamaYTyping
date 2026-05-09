import type { UserResult, WordResult } from "lyrics-ime-typing-engine";

export interface YTypingIme extends EventTarget {
	getUserResult: (id: string) => UserResult | undefined;
	getResultRanking: () => {
		rank: number;
		name: string;
		score: number;
		wordResults: WordResult[];
		currentWordIndex: number;
	}[];
	updateUserResult: (
		id: string,
		{
			name,
			typeCountDelta,
			newWordResults,
			nextWordIndex,
		}: {
			name: string;
			typeCountDelta: number;
			newWordResults: WordResult[];
			nextWordIndex: number;
		},
	) => void;
	updateUserName: (id: string, name: string) => void;
	handleImeInput: ({
		value,
		currentWordIndex,
		wordResults,
	}: {
		value: string;
		currentWordIndex: number | undefined;
		wordResults: WordResult[] | undefined;
	}) => {
		newWordResults: WordResult[];
		typeCountDelta: number;
		typeCountStatsDelta: number;
		nextWordIndex: number;
		appendNotifications: string[];
	};
	addNotifications(notifications: string[]): void;
}

interface YTyping {
	toast: {
		success(message: string): void;
		error(message: string): void;
	};
	setTypingLinkMode?(mode: "ime" | "type"): void;
}

declare global {
	interface Window {
		__ytyping_ime?: YTypingIme;
		__ytyping?: YTyping;
	}
}
