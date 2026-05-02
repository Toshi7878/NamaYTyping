import { GM_xmlhttpRequest } from "$";

// ---- YouTube internal API shapes ----------------------------------------

interface YtContinuationItem {
	invalidationContinuationData?: { continuation: string };
	reloadContinuationData?: { continuation: string };
	timedContinuationData?: { continuation: string; timeoutMs: number };
}

interface YtInitialData {
	contents?: {
		twoColumnWatchNextResults?: {
			conversationBar?: {
				liveChatRenderer?: {
					continuations?: YtContinuationItem[];
				};
			};
		};
	};
}

interface LiveChatContinuationItem {
	invalidationContinuationData?: { continuation: string; timeoutMs: number };
	timedContinuationData?: { continuation: string; timeoutMs: number };
}

interface LiveChatTextMessageRenderer {
	id: string;
	authorName?: { simpleText: string };
	message?: { runs?: Array<{ text?: string }> };
	timestampUsec: string;
	authorBadges?: Array<{
		liveChatAuthorBadgeRenderer?: { icon?: { iconType: string } };
	}>;
}

interface LiveChatResponse {
	continuationContents?: {
		liveChatContinuation?: {
			continuations?: LiveChatContinuationItem[];
			actions?: Array<{
				addChatItemAction?: {
					item?: { liveChatTextMessageRenderer?: LiveChatTextMessageRenderer };
				};
			}>;
		};
	};
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

export interface YTLiveChatClientOptions {
	liveId: string;
	onChat?: (messages: ChatMessage[]) => void;
	onError?: (error: Error) => void;
	onConnect?: (info: ConnectInfo) => void;
}

export interface StartOptions {
	/** start() 以前のチャットをコールバックしない（デフォルト: true） */
	skipExisting?: boolean;
}

// ---- Internal helpers ----------------------------------------------------

function getContinuationFromLiveId(liveId: string): Promise<string> {
	return new Promise((resolve, reject) => {
		GM_xmlhttpRequest({
			method: "GET",
			url: `https://www.youtube.com/watch?v=${liveId}`,
			onload(res) {
				const match = res.responseText.match(
					/ytInitialData\s*=\s*({.+?})\s*;<\/script>/s,
				);
				if (!match) return reject(new Error("ytInitialData not found"));

				let data: YtInitialData;
				try {
					data = JSON.parse(match[1]) as YtInitialData;
				} catch {
					return reject(new Error("Failed to parse ytInitialData"));
				}

				const continuations =
					data?.contents?.twoColumnWatchNextResults?.conversationBar
						?.liveChatRenderer?.continuations;

				const continuation =
					continuations?.[0]?.invalidationContinuationData?.continuation ??
					continuations?.[0]?.reloadContinuationData?.continuation;

				if (!continuation) return reject(new Error("continuation not found"));
				resolve(continuation);
			},
			onerror(e) {
				reject(new Error(`Network error: ${e.status}`));
			},
		});
	});
}

// ---- YTLiveChatClient ----------------------------------------------------

export class YTLiveChatClient {
	private readonly _liveId: string;
	private readonly _onChat: (messages: ChatMessage[]) => void;
	private readonly _onError: (error: Error) => void;
	private readonly _onConnect: (info: ConnectInfo) => void;

	private _alive = false;
	private _continuation: string | null = null;
	private _timer: ReturnType<typeof setTimeout> | null = null;
	private _startedAt = 0;

	constructor({ liveId, onChat, onError, onConnect }: YTLiveChatClientOptions) {
		if (!liveId) throw new Error("liveId is required");
		this._liveId = liveId;
		this._onChat = onChat ?? (() => undefined);
		this._onError = onError ?? console.error;
		this._onConnect = onConnect ?? (() => undefined);
	}

	async start({ skipExisting = true }: StartOptions = {}): Promise<void> {
		if (this._alive) return;
		try {
			this._continuation = await getContinuationFromLiveId(this._liveId);
			this._startedAt = skipExisting ? Date.now() * 1000 : 0; // マイクロ秒
			this._alive = true;
			this._onConnect({ liveId: this._liveId });
			this._poll();
		} catch (e) {
			this._onError(e instanceof Error ? e : new Error(String(e)));
		}
	}

	stop(): void {
		this._alive = false;
		if (this._timer !== null) clearTimeout(this._timer);
		this._timer = null;
		this._continuation = null;
		this._startedAt = 0;
	}

	isAlive(): boolean {
		return this._alive;
	}

	private _poll(): void {
		if (!this._alive || this._continuation === null) return;

		GM_xmlhttpRequest({
			method: "POST",
			url: "https://www.youtube.com/youtubei/v1/live_chat/get_live_chat",
			headers: { "Content-Type": "application/json" },
			data: JSON.stringify({
				context: { client: { clientName: "WEB", clientVersion: "2.20240101" } },
				continuation: this._continuation,
			}),
			onload: (res) => {
				try {
					this._handle(JSON.parse(res.responseText) as LiveChatResponse);
				} catch (e) {
					this._onError(e instanceof Error ? e : new Error(String(e)));
				}
			},
			onerror: (e) => {
				this._onError(new Error(`Network error: ${e.status}`));
			},
		});
	}

	private _handle(json: LiveChatResponse): void {
		const lcc = json?.continuationContents?.liveChatContinuation;
		if (!lcc) {
			this._alive = false;
			return;
		}

		const cont = lcc.continuations?.[0];
		const next =
			cont?.invalidationContinuationData?.continuation ??
			cont?.timedContinuationData?.continuation;
		const timeout =
			cont?.invalidationContinuationData?.timeoutMs ??
			cont?.timedContinuationData?.timeoutMs ??
			5000;

		if (next) this._continuation = next;

		const messages: ChatMessage[] = (lcc.actions ?? [])
			.map((a) => a?.addChatItemAction?.item?.liveChatTextMessageRenderer)
			.filter((r): r is LiveChatTextMessageRenderer => r !== undefined)
			.filter((r) => Number(r.timestampUsec) > this._startedAt)
			.map((r) => ({
				id: r.id,
				author: r.authorName?.simpleText ?? "",
				message: r.message?.runs?.map((run) => run.text ?? "").join("") ?? "",
				timestampUsec: r.timestampUsec,
				isMember: !!r.authorBadges?.some(
					(b) => b.liveChatAuthorBadgeRenderer?.icon?.iconType === "MEMBER",
				),
			}));

		if (messages.length > 0) this._onChat(messages);

		if (this._alive && next) {
			this._timer = setTimeout(() => this._poll(), timeout);
		} else {
			this._alive = false;
		}
	}
}
