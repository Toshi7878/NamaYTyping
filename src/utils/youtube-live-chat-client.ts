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
		liveChatRenderer?: {
			continuations?: YtContinuationItem[];
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

function getClientVersion(): string {
	const d = new Date(Date.now() - 86_400_000);
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `2.${d.getFullYear()}${mm}${dd}.01.00`;
}

function getContinuationFromLiveId(liveId: string): Promise<string> {
	return new Promise((resolve, reject) => {
		GM_xmlhttpRequest({
			method: "GET",
			url: `https://www.youtube.com/live_chat?is_popout=1&v=${liveId}`,
			onload(res) {
				const match = res.responseText.match(
					/(?:window\s*\[\s*["']ytInitialData["']\s*\]|window\.ytInitialData|ytInitialData)\s*=\s*({.+?})\s*;<\/script>/s,
				);
				if (!match) return reject(new Error("ytInitialData not found"));

				let data: YtInitialData;
				try {
					data = JSON.parse(match[1]) as YtInitialData;
				} catch {
					return reject(new Error("Failed to parse ytInitialData"));
				}

				const continuations =
					data?.contents?.liveChatRenderer?.continuations ??
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

class YTLiveChatClient {
	private readonly _liveId: string;
	private readonly _onChat: (messages: ChatMessage[]) => void;
	private readonly _onError: (error: Error) => void;
	private readonly _onConnect: (info: ConnectInfo) => void;

	private _alive = false;
	private _continuation: string | null = null;
	private _timer: ReturnType<typeof setTimeout> | null = null;
	private _startedAt = 0;
	private _visitorData: string | null = null;

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
		this._visitorData = null;
	}

	private _poll(): void {
		if (!this._alive || this._continuation === null) return;
		const requestStart = Date.now();

		GM_xmlhttpRequest({
			method: "POST",
			url: "https://www.youtube.com/youtubei/v1/live_chat/get_live_chat",
			headers: { "Content-Type": "application/json" },
			data: JSON.stringify({
				context: {
					client: {
						clientName: "WEB",
						clientVersion: getClientVersion(),
						...(this._visitorData ? { visitorData: this._visitorData } : {}),
					},
				},
				continuation: this._continuation,
			}),
			onload: (res) => {
				try {
					this._handle(
						JSON.parse(res.responseText) as LiveChatResponse,
						requestStart,
					);
				} catch (e) {
					this._onError(e instanceof Error ? e : new Error(String(e)));
				}
			},
			onerror: (e) => {
				this._onError(new Error(`Network error: ${e.status}`));
			},
		});
	}

	private _handle(json: LiveChatResponse, requestStart: number): void {
		const visitorData = (json as { responseContext?: { visitorData?: string } })
			?.responseContext?.visitorData;
		if (visitorData) this._visitorData = visitorData;

		const lcc = json?.continuationContents?.liveChatContinuation;
		if (!lcc) {
			this._alive = false;
			return;
		}

		const cont = lcc.continuations?.[0];
		const next =
			cont?.invalidationContinuationData?.continuation ??
			cont?.timedContinuationData?.continuation;
		const timeout = Math.min(
			cont?.invalidationContinuationData?.timeoutMs ??
				cont?.timedContinuationData?.timeoutMs ??
				5000,
			5000,
		);

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

		const elapsed = Date.now() - requestStart;
		const delay = Math.max(0, timeout - elapsed);

		if (this._alive && next) {
			this._timer = setTimeout(() => this._poll(), delay);
		} else {
			this._alive = false;
		}
	}
}

export function startLiveChat(options: YTLiveChatClientOptions): () => void {
	const client = new YTLiveChatClient(options);
	client.start();
	const unsubscribe = () => client.stop();
	return unsubscribe;
}
