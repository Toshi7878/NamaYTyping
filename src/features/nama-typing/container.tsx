import type { WordResult } from "lyrics-ime-typing-engine";
import { useRef } from "react";
import { LiveChatConnector } from "./live-chat-connerctor";

interface ChatState {
	author: string;
	currentWordIndex: number;
	typeCount: number;
	wordResults: WordResult[];
}

interface Props {
	host: HTMLDivElement;
}

export function NamaTypingContainer({ host }: Props) {
	const chatStatesRef = useRef(new Map<string, ChatState>());

	return (
		<LiveChatConnector
			onChat={(messages) => onChat(messages, chatStatesRef.current)}
			onConnect={onConnect}
			onEnd={() => onEnd(chatStatesRef.current)}
			onError={onError}
			host={host}
		/>
	);
}

function onChat(
	messages: Parameters<
		React.ComponentProps<typeof LiveChatConnector>["onChat"]
	>[0],
	chatStates: Map<string, ChatState>,
) {
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

function onConnect() {
	unsafeWindow.__ytyping?.toast.success("接続に成功しました");
}

function onEnd(chatStates: Map<string, ChatState>) {
	chatStates.forEach(({ author, typeCount }) => {
		unsafeWindow.__ytyping_ime?.addUserResult({
			name: author,
			typeCount,
		});
	});
}

function onError(e: Error) {
	unsafeWindow.__ytyping?.toast.error(`接続エラー: ${e.message}`);
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
