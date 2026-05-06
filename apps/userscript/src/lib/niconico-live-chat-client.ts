import { GM_xmlhttpRequest } from "$";

// ---- Watch page --------------------------------------------------------

const WATCH_PAGE_BASE_URL = "https://live2.nicovideo.jp/watch";

interface EmbeddedData {
	site?: { relive?: { webSocketUrl?: string } };
}

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
					const wsUrl = data.site?.relive?.webSocketUrl;
					if (!wsUrl) throw new Error("webSocketUrl not found in embedded-data");
					resolve(wsUrl);
				} catch (e) {
					reject(e instanceof Error ? e : new Error(String(e)));
				}
			},
			onerror(e) {
				reject(new Error(`Network error fetching watch page: ${e.status}`));
			},
		});
	});
}

// ---- Public types -------------------------------------------------------

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
	skipExisting?: boolean;
}

// ---- Minimal protobuf reader -------------------------------------------

class ProtoReader {
	private pos = 0;
	constructor(private buf: Uint8Array) {}

	hasMore(): boolean {
		return this.pos < this.buf.length;
	}

	readVarint(): number {
		let result = 0,
			shift = 0;
		while (this.pos < this.buf.length) {
			const byte = this.buf[this.pos++];
			result += (byte & 0x7f) * 2 ** shift;
			if (!(byte & 0x80)) return result;
			shift += 7;
		}
		throw new Error("Unexpected end of buffer in varint");
	}

	readBytes(): Uint8Array {
		const len = this.readVarint();
		const slice = this.buf.subarray(this.pos, this.pos + len);
		this.pos += len;
		return slice;
	}

	readString(): string {
		return new TextDecoder().decode(this.readBytes());
	}

	readTag(): { field: number; wireType: number } | null {
		if (!this.hasMore()) return null;
		const tag = this.readVarint();
		return { field: tag >>> 3, wireType: tag & 7 };
	}

	skip(wireType: number): void {
		switch (wireType) {
			case 0:
				this.readVarint();
				break;
			case 1:
				this.pos += 8;
				break;
			case 2:
				this.readBytes();
				break;
			case 5:
				this.pos += 4;
				break;
		}
	}
}

// ---- Protobuf decoders -------------------------------------------------

// ChunkedEntry (from message server)
// proto: dwango/nicolive/chat/service/edge/payload.proto
interface ChunkedEntry {
	segmentUri?: string; // MessageSegment.uri (field 1 → field 3)
	nextAt?: number; // ReadyForNext.at  (field 4 → field 1) in ms
}

function decodeChunkedEntry(buf: Uint8Array): ChunkedEntry {
	const r = new ProtoReader(buf);
	const result: ChunkedEntry = {};
	let tag;
	while ((tag = r.readTag()) !== null) {
		if (tag.wireType !== 2) {
			r.skip(tag.wireType);
			continue;
		}
		switch (tag.field) {
			case 1: {
				// segment: MessageSegment → field 3 = uri (string)
				const seg = new ProtoReader(r.readBytes());
				let t;
				while ((t = seg.readTag()) !== null) {
					if (t.field === 3 && t.wireType === 2) result.segmentUri = seg.readString();
					else seg.skip(t.wireType);
				}
				break;
			}
			case 4: {
				// ReadyForNext → field 1 = at (int64)
				const next = new ProtoReader(r.readBytes());
				let t;
				while ((t = next.readTag()) !== null) {
					if (t.field === 1 && t.wireType === 0) result.nextAt = next.readVarint();
					else next.skip(t.wireType);
				}
				break;
			}
			default:
				r.skip(tag.wireType);
		}
	}
	return result;
}

// PackedSegment (from segment server)
interface DecodedChat {
	content: string;
	no: number;
	accountStatus: number;
	rawUserId?: number;
	hashedUserId?: string;
}

function decodeChat(buf: Uint8Array): DecodedChat | undefined {
	const r = new ProtoReader(buf);
	const c: Partial<DecodedChat> & { content?: string } = {};
	let tag;
	while ((tag = r.readTag()) !== null) {
		switch (tag.field) {
			case 1:
				c.content = r.readString();
				break;
			case 2:
				r.readString(); // name — skip
				break;
			case 3:
				r.readVarint(); // vpos — skip
				break;
			case 4:
				c.accountStatus = r.readVarint();
				break;
			case 5:
				c.rawUserId = r.readVarint();
				break;
			case 6:
				c.hashedUserId = r.readString();
				break;
			case 8:
				c.no = r.readVarint();
				break;
			default:
				r.skip(tag.wireType);
		}
	}
	if (!c.content) return undefined;
	c.accountStatus ??= 0;
	c.no ??= 0;
	return c as DecodedChat;
}

function decodeChunkedMessage(buf: Uint8Array): {
	chat: DecodedChat;
	timestampSec: number;
} | undefined {
	const r = new ProtoReader(buf);
	let timestampSec = 0;
	let chat: DecodedChat | undefined;
	let tag;
	while ((tag = r.readTag()) !== null) {
		if (tag.wireType !== 2) {
			r.skip(tag.wireType);
			continue;
		}
		switch (tag.field) {
			case 1: {
				// Meta → field 2 = Timestamp → field 1 = seconds
				const meta = new ProtoReader(r.readBytes());
				let mt;
				while ((mt = meta.readTag()) !== null) {
					if (mt.field === 2 && mt.wireType === 2) {
						const ts = new ProtoReader(meta.readBytes());
						let tt;
						while ((tt = ts.readTag()) !== null) {
							if (tt.field === 1 && tt.wireType === 0) timestampSec = ts.readVarint();
							else ts.skip(tt.wireType);
						}
					} else {
						meta.skip(mt.wireType);
					}
				}
				break;
			}
			case 2: {
				// NicoliveMessage → field 1 = Chat
				const msg = new ProtoReader(r.readBytes());
				let mt;
				while ((mt = msg.readTag()) !== null) {
					if (mt.field === 1 && mt.wireType === 2) {
						chat = decodeChat(msg.readBytes());
					} else {
						msg.skip(mt.wireType);
					}
				}
				break;
			}
			default:
				r.skip(tag.wireType);
		}
	}
	if (!chat) return undefined;
	return { chat, timestampSec };
}

interface DecodedPackedSegment {
	chats: Array<{ chat: DecodedChat; timestampSec: number }>;
	nextUri?: string;
}

function decodePackedSegment(buf: Uint8Array): DecodedPackedSegment {
	const r = new ProtoReader(buf);
	const result: DecodedPackedSegment = { chats: [] };
	let tag;
	while ((tag = r.readTag()) !== null) {
		if (tag.wireType !== 2) {
			r.skip(tag.wireType);
			continue;
		}
		switch (tag.field) {
			case 1: {
				// repeated ChunkedMessage
				const decoded = decodeChunkedMessage(r.readBytes());
				if (decoded) result.chats.push(decoded);
				break;
			}
			case 2: {
				// Next → field 1 = uri
				const next = new ProtoReader(r.readBytes());
				let t;
				while ((t = next.readTag()) !== null) {
					if (t.field === 1 && t.wireType === 2) result.nextUri = next.readString();
					else next.skip(t.wireType);
				}
				break;
			}
			default:
				r.skip(tag.wireType);
		}
	}
	return result;
}

// ---- Chunk splitter ----------------------------------------------------
// Splits the custom-framed binary stream into individual protobuf blobs.
// Each frame: [varint: payload_length][payload bytes]

class ChunkSplitter {
	private buffer = new Uint8Array(0);

	addData(data: Uint8Array): void {
		const merged = new Uint8Array(this.buffer.length + data.length);
		merged.set(this.buffer);
		merged.set(data, this.buffer.length);
		this.buffer = merged;
	}

	*read(): IterableIterator<Uint8Array> {
		let offset = 0;
		while (true) {
			const varint = this._decodeVarint(this.buffer, offset);
			if (varint === null) break;
			const { value, offset: varintEnd } = varint;
			const start = varintEnd + 1;
			const end = start + value;
			if (this.buffer.length < end) break;
			yield this.buffer.subarray(start, end);
			offset = end;
		}
		if (offset > 0) this.buffer = this.buffer.slice(offset);
	}

	private _decodeVarint(
		buf: Uint8Array,
		pos: number,
	): { value: number; offset: number } | null {
		let value = 0,
			more = false,
			shift = 0;
		do {
			if (buf.length <= pos) return null;
			const byte = buf[pos];
			more = Boolean(byte & 128);
			value |= (byte & 127) << shift;
			if (more) {
				pos++;
				shift += 7;
			}
		} while (more);
		return { value, offset: pos };
	}
}

// ---- HTTP stream receiver ----------------------------------------------

interface AbortHandle {
	abort(): void;
}

function openHttpStream(
	url: string,
	onData: (data: Uint8Array) => void,
	onDone: () => void,
	onError: (e: Error) => void,
): AbortHandle {
	let processedLength = 0;

	const handle = GM_xmlhttpRequest({
		method: "GET",
		url,
		headers: { "Sec-Fetch-Mode": "no-cors" },
		responseType: "arraybuffer",
		onprogress(res) {
			if (!res.response) return;
			const buf = new Uint8Array(res.response as ArrayBuffer);
			if (buf.length > processedLength) {
				onData(buf.subarray(processedLength));
				processedLength = buf.length;
			}
		},
		onload(res) {
			if (res.response) {
				const buf = new Uint8Array(res.response as ArrayBuffer);
				if (buf.length > processedLength) {
					onData(buf.subarray(processedLength));
				}
			}
			onDone();
		},
		onerror(res) {
			onError(new Error(`HTTP stream error: status=${res.status}`));
		},
	});

	return handle as AbortHandle;
}

// ---- NiconicoLiveChatClient --------------------------------------------

class NiconicoLiveChatClient {
	private readonly _liveId: string;
	private readonly _onChat: (messages: ChatMessage[]) => void;
	private readonly _onError: (error: Error) => void;
	private readonly _onConnect: (info: ConnectInfo) => void;

	private _alive = false;
	private _startedAt = 0;
	private _watchWs: WebSocket | null = null;
	private _keepSeatTimer: ReturnType<typeof setInterval> | null = null;
	private _messageStreamHandle: AbortHandle | null = null;
	private _segmentStreamHandle: AbortHandle | null = null;
	private _messageServerUri: string | null = null;
	private _nextStreamAt = "now";
	private _connectedOnce = false;

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
			const wsUrl = await getWatchWebSocketUrl(this._liveId);
			if (!this._alive) return;
			this._connectWatch(wsUrl);
		} catch (e) {
			this._alive = false;
			this._onError(e instanceof Error ? e : new Error(String(e)));
		}
	}

	stop(): void {
		this._alive = false;
		this._clearKeepSeat();
		this._watchWs?.close();
		this._watchWs = null;
		this._messageStreamHandle?.abort();
		this._messageStreamHandle = null;
		this._segmentStreamHandle?.abort();
		this._segmentStreamHandle = null;
	}

	private _clearKeepSeat(): void {
		if (this._keepSeatTimer !== null) {
			clearInterval(this._keepSeatTimer);
			this._keepSeatTimer = null;
		}
	}

	private _connectWatch(wsUrl: string): void {
		const ws = new WebSocket(wsUrl);
		this._watchWs = ws;

		ws.addEventListener("open", () => {
			ws.send(
				JSON.stringify({
					type: "startWatching",
					data: {
						stream: {
							quality: "abr",
							protocol: "hls",
							latency: "high",
							chasePlay: false,
						},
						room: { protocol: "webSocket", commentable: true },
						reconnect: false,
					},
				}),
			);
		});

		ws.addEventListener("message", (event) => {
			let msg: { type?: string; data?: unknown };
			try {
				msg = JSON.parse(event.data as string);
			} catch {
				return;
			}
			this._handleWatchMessage(msg);
		});

		ws.addEventListener("error", () => {
			this._onError(new Error("Watch WebSocket error"));
		});

		ws.addEventListener("close", () => {
			this._clearKeepSeat();
		});
	}

	private _handleWatchMessage(msg: { type?: string; data?: unknown }): void {
		switch (msg.type) {
			case "seat": {
				const intervalSec =
					(msg.data as { keepIntervalSec?: number })?.keepIntervalSec ?? 30;
				this._clearKeepSeat();
				this._keepSeatTimer = setInterval(() => {
					if (this._watchWs?.readyState === WebSocket.OPEN) {
						this._watchWs.send(JSON.stringify({ type: "keepSeat" }));
					}
				}, intervalSec * 1000);
				break;
			}
			case "ping":
				if (this._watchWs?.readyState === WebSocket.OPEN) {
					this._watchWs.send(JSON.stringify({ type: "pong" }));
				}
				break;
			case "disconnect": {
				const reason = (msg.data as { reason?: string })?.reason;
				this._clearKeepSeat();
				if (reason === "END_PROGRAM") {
					this.stop();
				} else {
					this._onError(new Error(`Disconnected: ${reason ?? "unknown"}`));
				}
				break;
			}
			case "messageServer": {
				const { viewUri } =
					(msg.data as { viewUri?: string; vposBaseTime?: string }) ?? {};
				if (!viewUri) return;
				this._messageServerUri = viewUri;
				this._nextStreamAt = "now";
				this._connectMessageServer();
				break;
			}
		}
	}

	private _connectMessageServer(): void {
		if (!this._alive || !this._messageServerUri) return;
		this._messageStreamHandle?.abort();

		const prevAt = this._nextStreamAt;
		const url = `${this._messageServerUri}&at=${this._nextStreamAt}`;
		const splitter = new ChunkSplitter();

		this._messageStreamHandle = openHttpStream(
			url,
			(data) => {
				splitter.addData(data);
				for (const chunk of splitter.read()) {
					const entry = decodeChunkedEntry(chunk);
					if (entry.segmentUri) {
						if (!this._connectedOnce) {
							this._connectedOnce = true;
							this._onConnect({ liveId: this._liveId });
						}
						this._startSegment(entry.segmentUri);
					}
					if (entry.nextAt !== undefined) {
						this._nextStreamAt = String(entry.nextAt);
					}
				}
			},
			() => {
				if (!this._alive) return;
				// nextAt が更新されていなければ接続異常
				if (this._nextStreamAt === prevAt) {
					this._onError(
						new Error("Message server disconnected without updating nextAt"),
					);
					return;
				}
				this._connectMessageServer();
			},
			(e) => {
				this._onError(e);
			},
		);
	}

	private _startSegment(uri: string): void {
		if (!this._alive) return;
		this._segmentStreamHandle?.abort();

		const splitter = new ChunkSplitter();
		let nextUri: string | undefined;

		const connect = (segUri: string): void => {
			if (!this._alive) return;
			this._segmentStreamHandle = openHttpStream(
				segUri,
				(data) => {
					splitter.addData(data);
					for (const chunk of splitter.read()) {
						const seg = decodePackedSegment(chunk);
						if (seg.nextUri) nextUri = seg.nextUri;
						const messages = this._toMessages(seg.chats);
						if (messages.length > 0) this._onChat(messages);
					}
				},
				() => {
					if (!this._alive) return;
					if (nextUri) connect(nextUri);
				},
				(e) => {
					this._onError(e);
				},
			);
		};

		connect(uri);
	}

	private _toMessages(
		chats: Array<{ chat: DecodedChat; timestampSec: number }>,
	): ChatMessage[] {
		return chats
			.map(({ chat, timestampSec }) => {
				if (!chat.content || chat.content.startsWith("/")) return undefined;
				const timestampUsec = String(timestampSec * 1_000_000);
				if (this._startedAt > 0 && Number(timestampUsec) <= this._startedAt)
					return undefined;
				const author =
					chat.hashedUserId ?? chat.rawUserId?.toString() ?? "anonymous";
				return {
					id: String(chat.no),
					author,
					message: chat.content,
					timestampUsec,
					isMember: chat.accountStatus > 0,
				} satisfies ChatMessage;
			})
			.filter((m): m is ChatMessage => m !== undefined);
	}
}

// ---- Public API --------------------------------------------------------

export function subscribeNiconicoLiveChat(
	options: NiconicoLiveChatClientOptions,
): () => void {
	const client = new NiconicoLiveChatClient(options);
	client.start();
	return () => client.stop();
}
