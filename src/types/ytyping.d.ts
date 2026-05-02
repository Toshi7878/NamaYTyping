// Global declarations for ytyping.net page APIs

interface EvaluateImeInputResult {
	nextWordIndex: number | null;
	typeCountDelta: number;
	wordResultUpdates: Array<{ index: number; result: unknown }>;
	notificationsToAppend: string[];
}

interface YTypingIme extends EventTarget {
	getBuiltMap(): { initWordResults: unknown[] } | null;
	evaluateImeInput(params: {
		value: string;
		currentWordIndex: number;
		wordResults: unknown[];
	}): EvaluateImeInputResult;
	addNotifications(notifications: string[]): void;
	addUserResult(result: { name: string; typeCount: number }): void;
}

interface YTyping {
	toast: {
		success(message: string): void;
		error(message: string): void;
	};
	setMapLinkMode?(mode: "ime" | "type"): void;
}

// biome-ignore lint/correctness/noUnusedVariables: global Window augmentation — declaration merging extends the built-in type without being directly referenced
interface Window {
	__ytyping_ime?: YTypingIme;
	__ytyping?: YTyping;
}
