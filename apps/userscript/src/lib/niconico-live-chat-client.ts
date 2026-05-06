import { GM_xmlhttpRequest } from "$";

const WATCH_PAGE_BASE_URL = "https://live2.nicovideo.jp/watch";
const COMMENT_PROTOCOL = "msg.nicovideo.jp#json";

// ---- Niconico watch page / WebSocket shapes ------------------------------

interface EmbeddedData {
	site?: {
		relive?: {
			webSocketUrl?: string;
		};
	};
}

interface RoomMessage {
	type: "room";
	data?: {
		name?: string;
		messageServer?: {
			uri?: string;
			type?: string;
		};
		threadId?: string;
		isFirst?: boolean;
	};
}

interface ErrorMessage {
	type: "error";
	data?: {
		message?: string;
	};
}

type WatchWebSocketMessage = RoomMessage | ErrorMessage | { type?: string };

interface NiconicoChatPayload {
	thread?: string;
	no?: number;
	content?: string;
	date?: number;
	date_usec?: number;
	user_id?: string;
	premium?: number;
}

// ---- Public types --------------------------------------------------------

export interface ChatMessage {
	id: string;
	author: string;
	message: string;
	timestampUsec: string;
	isMember: boolean;
}

export interface ConnectInfo {
	liveId: string;
}

export interface NiconicoLiveChatClientOptions {
	liveId: string;
	onChat?: (messages: ChatMessage[]) => void;
	onError?: (error: Error) => void;
	onConnect?: (info: ConnectInfo) => void;
}

export interface StartOptions {
	/** Do not emit comments posted before start(). Default: true. */
	skipExisting?: boolean;
}

// ---- Internal helpers ----------------------------------------------------

function getWatchWebSocketUrl(liveId: string): Promise<string> {
	return new Promise((resolve, reject) => {
		GM_xmlhttpRequest({
			method: "GET",
			url: `${WATCH_PAGE_BASE_URL}/${encodeURIComponent(liveId)}`,
			onload(res) {
				try {
					const doc = new DOMParser().parseFromString(
						res.responseText,
						"text/html",
					);
					const raw = doc
						.querySelector("#embedded-data")
						?.getAttribute("data-props");
					if (!raw) throw new Error("embedded-data not found");

					const data = JSON.parse(raw) as EmbeddedData;
					const webSocketUrl = data.site?.relive?.webSocketUrl;
					if (!webSocketUrl) throw new Error("relive WebSocket URL not found");

					resolve(webSocketUrl);
				} catch (e) {
					reject(e instanceof Error ? e : new Error(String(e)));
				}
			},
			onerror(e) {
				reject(new Error(`Network error: ${e.status}`));
			},
		});
	});
}

function parseJsonMessage(data: unknown): unknown | undefined {
	if (typeof data !== "string" || data.length === 0) return undefined;
	try {
		return JSON.parse(data);
	} catch {
		return undefined;
	}
}

function isRoomMessage(message: WatchWebSocketMessage): message is RoomMessage {
	return message.type === "room";
}

function isErrorMessage(
	message: WatchWebSocketMessage,
): message is ErrorMessage {
	return message.type === "error";
}

function toTimestampUsec(payload: NiconicoChatPayload): string {
	const sec = payload.date ?? Math.floor(Date.now() / 1000);
	const usec = payload.date_usec ?? 0;
	return String(sec * 1_000_000 + usec);
}

function toChatMessage(
	payload: NiconicoChatPayload,
	threadId: string,
): ChatMessage | undefined {
	const message = payload.content ?? "";
	if (!message || message.startsWith("/")) return undefined;

	const timestampUsec = toTimestampUsec(payload);
	const no = payload.no ?? crypto.getRandomValues(new Uint32Array(1))[0];

	return {
		id: `${threadId}:${no}`,
		author: payload.user_id ?? "anonymous",
		message,
		timestampUsec,
		isMember: (payload.premium ?? 0) > 0,
	};
}

// ---- NiconicoLiveChatClient ---------------------------------------------

class NiconicoLiveChatClient {
	private readonly _liveId: string;
	private readonly _onChat: (messages: ChatMessage[]) => void;
	private readonly _onError: (error: Error) => void;
	private readonly _onConnect: (info: ConnectInfo) => void;

	private _alive = false;
	private _watchWs: WebSocket | null = null;
	private _commentWs: WebSocket | null = null;
	private _startedAt = 0;

	constructor({
		liveId,
		onChat,
		onError,
		onConnect,
	}: NiconicoLiveChatClientOptions) {
		if (!liveId) throw new Error("liveId is required");
		this._liveId = liveId;
		this._onChat = onChat ?? (() => undefined);
		this._onError = onError ?? console.error;
		this._onConnect = onConnect ?? (() => undefined);
	}

	async start({ skipExisting = true }: StartOptions = {}): Promise<void> {
		if (this._alive) return;
		this._startedAt = skipExisting ? Date.now() * 1000 : 0;
		this._alive = true;

		try {
			const webSocketUrl = await getWatchWebSocketUrl(this._liveId);
			if (!this._alive) return;
			this._connectWatchSession(webSocketUrl);
		} catch (e) {
			this._alive = false;
			this._onError(e instanceof Error ? e : new Error(String(e)));
		}
	}

	stop(): void {
		this._alive = false;
		this._watchWs?.close();
		this._commentWs?.close();
		this._watchWs = null;
		this._commentWs = null;
		this._startedAt = 0;
	}

	private _connectWatchSession(webSocketUrl: string): void {
		const ws = new WebSocket(webSocketUrl);
		this._watchWs = ws;

		ws.addEventListener("open", () => {
			ws.send(
				JSON.stringify({
					type: "startWatching",
					data: {
						stream: {
							quality: "low",
							protocol: "hls",
							latency: "high",
						},
						room: {
							protocol: "webSocket",
							commentable: false,
						},
						reconnect: false,
					},
				}),
			);
		});

		ws.addEventListener("message", (event) => {
			const message = parseJsonMessage(event.data) as
				| WatchWebSocketMessage
				| undefined;
			if (!message) return;
			this._handleWatchMessage(message);
		});

		ws.addEventListener("error", () => {
			this._onError(new Error("Niconico watch WebSocket error"));
		});

		ws.addEventListener("close", () => {
			if (!this._alive || this._commentWs) return;
			this._onError(new Error("Niconico watch WebSocket closed"));
		});
	}

	private _handleWatchMessage(message: WatchWebSocketMessage): void {
		if (isErrorMessage(message)) {
			this._onError(new Error(message.data?.message ?? "Niconico watch error"));
			return;
		}

		if (!isRoomMessage(message)) return;

		const serverUri = message.data?.messageServer?.uri;
		const threadId = message.data?.threadId;
		if (!serverUri || !threadId) return;

		this._connectCommentSession(serverUri, threadId);
	}

	private _connectCommentSession(serverUri: string, threadId: string): void {
		if (this._commentWs) return;

		const ws = new WebSocket(serverUri, COMMENT_PROTOCOL);
		this._commentWs = ws;

		ws.addEventListener("open", () => {
			ws.send(
				JSON.stringify([
					{
						thread: {
							thread: threadId,
							version: "20061206",
							user_id: "guest",
							res_from: -100,
							with_global: 1,
							scores: 1,
							nicoru: 0,
						},
					},
				]),
			);
			this._onConnect({ liveId: this._liveId });
		});

		ws.addEventListener("message", (event) => {
			const parsed = parseJsonMessage(event.data);
			const payloads = Array.isArray(parsed) ? parsed : [parsed];
			const messages = payloads
				.map((payload) => {
					const chat = (payload as { chat?: NiconicoChatPayload } | undefined)
						?.chat;
					return chat ? toChatMessage(chat, threadId) : undefined;
				})
				.filter((message): message is ChatMessage => message !== undefined)
				.filter((message) => Number(message.timestampUsec) > this._startedAt);

			if (messages.length > 0) this._onChat(messages);
		});

		ws.addEventListener("error", () => {
			this._onError(new Error("Niconico comment WebSocket error"));
		});

		ws.addEventListener("close", () => {
			this._commentWs = null;
			if (!this._alive) return;
			this._onError(new Error("Niconico comment WebSocket closed"));
		});
	}
}

export function subscribeNiconicoLiveChat(
	options: NiconicoLiveChatClientOptions,
): () => void {
	const client = new NiconicoLiveChatClient(options);
	client.start();
	return () => client.stop();
}
