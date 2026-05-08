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

const STORAGE_KEY_NICO_NAMES = "nama-typing:nico-names";

function getNicoNames(): Record<string, string> {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY_NICO_NAMES) ?? "{}") as Record<string, string>;
	} catch {
		return {};
	}
}

function setNicoName(author: string, name: string): void {
	const names = getNicoNames();
	names[author] = name;
	localStorage.setItem(STORAGE_KEY_NICO_NAMES, JSON.stringify(names));
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

	const nicoNames = getNicoNames();

	for (const m of messages) {
		console.log(m);
		if (!processChatMessage(ime, m, nicoNames)) continue;
	}
}

function processChatMessage(
	ime: NonNullable<typeof unsafeWindow.__ytyping_ime>,
	m: ChatMessage,
	nicoNames: Record<string, string>,
): boolean {
	if (m.platform === "niconico" && tryRegisterNicoName(m, nicoNames)) return false;

	const displayName =
		m.platform === "niconico" ? (nicoNames[m.author] ?? m.author) : m.author;

	const userResult = ime.getUserResult(m.author);

	const result = ime.handleImeInput({
		value: m.message,
		currentWordIndex: userResult?.currentWordIndex,
		wordResults: userResult?.wordResults,
	});

	ime.updateUserResult(m.author, {
		name: displayName,
		typeCountDelta: result.typeCountDelta,
		newWordResults: result.newWordResults,
		nextWordIndex: result.nextWordIndex,
	});

	ime.addNotifications(
		result.appendNotifications.map((n) => `${displayName}: ${n}`),
	);

	return true;
}

function tryRegisterNicoName(
	m: ChatMessage,
	nicoNames: Record<string, string>,
): boolean {
	const match = m.message.match(/^@(.+)/);
	if (!match) return false;

	const name = match[1].trim();
	nicoNames[m.author] = name;
	setNicoName(m.author, name);
	return true;
}
