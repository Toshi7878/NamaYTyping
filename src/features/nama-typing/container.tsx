import type { WordResult } from "lyrics-ime-typing-engine";
import { useRef } from "react";
import type { ChatMessage } from "@/utils/youtube-live-chat-client";
import { unsafeWindow } from "$";
import { ImeLiveChatConnector } from "./ime-live-chat-connerctor";

interface ChatState {
	author: string;
	currentWordIndex: number;
	typeCount: number;
	wordResults: WordResult[];
}

export const NamaTypingContainer = () => {
	const chatStatesRef = useRef(new Map<string, ChatState>());

	return (
		<ImeLiveChatConnector
			onChat={(messages) => onChat(messages, chatStatesRef.current)}
			onConnect={() =>
				unsafeWindow.__ytyping?.toast.success("ライブチャットに接続しました")
			}
			onEnd={() => onEnd(chatStatesRef.current)}
			onError={(e) =>
				unsafeWindow.__ytyping?.toast.error(`接続エラー: ${e.message}`)
			}
		/>
	);
};

function onChat(messages: ChatMessage[], chatStates: Map<string, ChatState>) {
	for (const m of messages) {
		const state = getChatState(m.author, chatStates);

		const result = unsafeWindow.__ytyping_ime?.evaluateImeInput({
			value: m.message,
			currentWordIndex: state.currentWordIndex,
			wordResults: state.wordResults,
		});
		if (!result) continue;

		const newWordResults = [...state.wordResults];
		for (const { index, result: wordResult } of result.wordResultUpdates) {
			newWordResults[index] = wordResult;
		}

		chatStates.set(m.author, {
			...state,
			currentWordIndex: result.nextWordIndex ?? state.currentWordIndex,
			typeCount: state.typeCount + result.typeCountDelta,
			wordResults: newWordResults,
		});

		unsafeWindow.__ytyping_ime?.addNotifications(
			result.notificationsToAppend.map((n) => `${m.author}: ${n}`),
		);
	}
}

function onEnd(chatStates: Map<string, ChatState>) {
	chatStates.forEach(({ author, typeCount }) => {
		unsafeWindow.__ytyping_ime?.addUserResult({
			name: author,
			typeCount,
		});
	});
}

function getChatState(
	author: string,
	chatStatesRef: Map<string, ChatState>,
): ChatState {
	if (!chatStatesRef.has(author)) {
		const initWordResults =
			unsafeWindow.__ytyping_ime?.getBuiltMap()?.initWordResults ?? [];
		chatStatesRef.set(author, {
			author,
			currentWordIndex: 0,
			typeCount: 0,
			wordResults: initWordResults,
		});
	}
	const state = chatStatesRef.get(author);
	if (!state) {
		throw new Error(`Chat state not found for author: ${author}`);
	}
	return state;
}
