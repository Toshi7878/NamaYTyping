import { unsafeWindow } from "$";
import { ImeLiveChatConnector } from "./ime-live-chat-connerctor";

type Platform = "youtube" | "twitch" | "niconico";
export interface ChatMessage {
	platform: Platform;
	id: string;
	author: string;
	message: string;
	timestampUsec: string;
	isMember: boolean;
}

export const NamaTypingContainer = () => {
	return (
		<ImeLiveChatConnector
			onChat={(messages) => onChat(messages)}
			onConnect={() =>
				unsafeWindow.__ytyping?.toast.success("ライブチャットに接続しました")
			}
			onError={(e) =>
				unsafeWindow.__ytyping?.toast.error(`接続エラー: ${e.message}`)
			}
		/>
	);
};

function onChat(messages: ChatMessage[]) {
	const ime = unsafeWindow.__ytyping_ime;
	if (!ime) return;

	for (const m of messages) {
		console.log(m);
		const userResult = ime.getUserResult(m.author);

		const result = ime.handleImeInput({
			value: m.message,
			currentWordIndex: userResult?.currentWordIndex,
			wordResults: userResult?.wordResults,
		});

		ime.updateUserResult(m.author, {
			name: m.author,
			typeCountDelta: result.typeCountDelta,
			newWordResults: result.newWordResults,
			nextWordIndex: result.nextWordIndex,
		});

		ime.addNotifications(
			result.appendNotifications.map((n) => `${m.author}: ${n}`),
		);
	}
}
