import type {
	BuiltImeLine,
	UserResult,
	WordResult,
} from "lyrics-ime-typing-engine";

export interface YTypingIme extends EventTarget {
	getBuiltMap: () => {
		lines: BuiltImeLine[];
		words: string[][][][];
		totalNotes: number;
		initWordResults: WordResult[];
		flatWords: string[];
	} | null;
	ensureMapInfo: () => Promise<{
		id: number;
		media: {
			previewTime: number;
			thumbnailQuality: "mqdefault" | "maxresdefault";
			videoId: string;
		};
		info: {
			tags: string[];
			title: string;
			artistName: string;
			source: string;
			duration: number;
			visibility: "PUBLIC" | "UNLISTED";
		};
		creator: {
			id: number;
			name: string | null;
			comment: string;
		};
		difficulty: {
			romaKpmMedian: number;
			kanaKpmMedian: number;
			romaKpmMax: number;
			kanaKpmMax: number;
			romaTotalNotes: number;
			kanaTotalNotes: number;
			rating: number;
		};
		like: {
			hasLiked: boolean;
		};
		bookmark: {
			hasBookmarked: boolean;
		};
		createdAt: Date;
		updatedAt: Date;
	} | null>;
	getUserResult: (id: string) => UserResult | undefined;
	getUserResults: () => Array<UserResult & { userId: string }>;
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
