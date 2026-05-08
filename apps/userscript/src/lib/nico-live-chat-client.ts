import { GM_xmlhttpRequest } from "$";

const WATCH_PAGE_BASE_URL = "https://live.nicovideo.jp/watch";
const TEXT_DECODER = new TextDecoder();

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

export interface NicoLiveChatClientOptions {
	liveId: string;
	onChat?: (messages: ChatMessage[]) => void;
	onError?: (error: Error) => void;
	onConnect?: (info: ConnectInfo) => void;
}

export interface StartOptions {
	/** Ignore comments whose protobuf timestamp is older than start(). */
	skipExisting?: boolean;
}

interface EmbeddedData {
	site?: {
		relive?: {
			webSocketUrl?: string;
		};
	};
}

interface WatchMessage {
	type: string;
	data?: Record<string, unknown>;
}

interface DecodedEntry {
	segmentUri?: string;
	previousUri?: string;
	nextAt?: string;
}

interface DecodedChat {
	content: string;
	name?: string;
	accountStatus: number;
	rawUserId?: number;
	hashedUserId?: string;
	no: number;
}

interface DecodedChunkedMessage {
	id?: string;
	chat: DecodedChat;
	timestampSec: number;
	timestampNanos: number;
}

type GmRequestHandle = ReturnType<typeof GM_xmlhttpRequest>;

function gmGetText(url: string): Promise<string> {
	return new Promise((resolve, reject) => {
		GM_xmlhttpRequest({
			method: "GET",
			url,
			onload(res) {
				if (res.status !== 0 && (res.status < 200 || res.status >= 300)) {
					reject(new Error(`GET ${url} failed: HTTP ${res.status}`));
					return;
				}
				resolve(res.responseText);
			},
			onerror(res) {
				reject(new Error(`GET ${url} failed: status=${res.status}`));
			},
		});
	});
}

async function getWatchWebSocketUrl(liveId: string): Promise<string> {
	const html = await gmGetText(
		`${WATCH_PAGE_BASE_URL}/${encodeURIComponent(liveId)}`,
	);
	const doc = new DOMParser().parseFromString(html, "text/html");
	const raw = doc.querySelector("#embedded-data")?.getAttribute("data-props");
	if (!raw) throw new Error("embedded-data not found");

	const data = JSON.parse(raw) as EmbeddedData;
	const wsUrl = data.site?.relive?.webSocketUrl;
	if (!wsUrl) throw new Error("webSocketUrl not found in embedded-data");
	return wsUrl;
}

class ProtoReader {
	private readonly buf: Uint8Array;
	pos = 0;

	constructor(buf: Uint8Array) {
		this.buf = buf;
	}

	hasMore(): boolean {
		return this.pos < this.buf.length;
	}

	readVarint(): number {
		let result = 0;
		let multiplier = 1;

		while (this.pos < this.buf.length) {
			const byte = this.buf[this.pos++];
			result += (byte & 0x7f) * multiplier;
			if ((byte & 0x80) === 0) return result;
			multiplier *= 128;
		}

		throw new Error("Unexpected end of protobuf varint");
	}

	readBytes(): Uint8Array {
		const len = this.readVarint();
		if (this.pos + len > this.buf.length) {
			throw new Error("Unexpected end of protobuf bytes");
		}
		const slice = this.buf.subarray(this.pos, this.pos + len);
		this.pos += len;
		return slice;
	}

	readString(): string {
		return TEXT_DECODER.decode(this.readBytes());
	}

	readTag(): { field: number; wireType: number } | undefined {
		if (!this.hasMore()) return undefined;
		const tag = this.readVarint();
		return { field: tag >>> 3, wireType: tag & 0x07 };
	}

	skip(wireType: number): void {
		switch (wireType) {
			case 0:
				this.readVarint();
				return;
			case 1:
				this.pos += 8;
				return;
			case 2:
				this.readBytes();
				return;
			case 5:
				this.pos += 4;
				return;
			default:
				throw new Error(`Unsupported protobuf wire type: ${wireType}`);
		}
	}
}

class SizeDelimitedSplitter {
	private buffer = new Uint8Array(0);

	addData(data: Uint8Array): void {
		if (data.length === 0) return;
		const merged = new Uint8Array(this.buffer.length + data.length);
		merged.set(this.buffer);
		merged.set(data, this.buffer.length);
		this.buffer = merged;
	}

	*read(): Iterable<Uint8Array> {
		let offset = 0;

		while (offset < this.buffer.length) {
			const header = this.readSize(offset);
			if (!header) break;

			const start = header.nextOffset;
			const end = start + header.size;
			if (this.buffer.length < end) break;

			yield this.buffer.subarray(start, end);
			offset = end;
		}

		if (offset > 0) this.buffer = this.buffer.slice(offset);
	}

	private readSize(
		offset: number,
	): { size: number; nextOffset: number } | undefined {
		let size = 0;
		let multiplier = 1;

		for (let pos = offset; pos < this.buffer.length; pos++) {
			const byte = this.buffer[pos];
			size += (byte & 0x7f) * multiplier;
			if ((byte & 0x80) === 0) return { size, nextOffset: pos + 1 };
			multiplier *= 128;
		}

		return undefined;
	}
}

function decodeUriMessage(buf: Uint8Array): string | undefined {
	const reader = new ProtoReader(buf);
	let uri: string | undefined;

	while (true) {
		const tag = reader.readTag();
		if (!tag) break;

		if ((tag.field === 1 || tag.field === 3) && tag.wireType === 2) {
			uri = reader.readString();
		} else {
			reader.skip(tag.wireType);
		}
	}

	return uri;
}

function decodeReadyForNext(buf: Uint8Array): string | undefined {
	const reader = new ProtoReader(buf);

	while (true) {
		const tag = reader.readTag();
		if (!tag) break;

		if (tag.field === 1) {
			return tag.wireType === 2
				? reader.readString()
				: String(reader.readVarint());
		}
		reader.skip(tag.wireType);
	}

	return undefined;
}

function decodeChunkedEntry(buf: Uint8Array): DecodedEntry {
	const reader = new ProtoReader(buf);
	const entry: DecodedEntry = {};

	while (true) {
		const tag = reader.readTag();
		if (!tag) break;

		if (tag.wireType !== 2) {
			reader.skip(tag.wireType);
			continue;
		}

		const fieldBytes = reader.readBytes();
		switch (tag.field) {
			case 1:
				entry.segmentUri = decodeUriMessage(fieldBytes);
				break;
			case 3:
				entry.previousUri = decodeUriMessage(fieldBytes);
				break;
			case 4:
				entry.nextAt = decodeReadyForNext(fieldBytes);
				break;
		}
	}

	return entry;
}

function decodeTimestamp(buf: Uint8Array): { sec: number; nanos: number } {
	const reader = new ProtoReader(buf);
	let sec = 0;
	let nanos = 0;

	while (true) {
		const tag = reader.readTag();
		if (!tag) break;

		if (tag.field === 1 && tag.wireType === 0) {
			sec = reader.readVarint();
		} else if (tag.field === 2 && tag.wireType === 0) {
			nanos = reader.readVarint();
		} else {
			reader.skip(tag.wireType);
		}
	}

	return { sec, nanos };
}

function decodeMeta(buf: Uint8Array): {
	id?: string;
	timestampSec: number;
	timestampNanos: number;
} {
	const reader = new ProtoReader(buf);
	let id: string | undefined;
	let timestampSec = 0;
	let timestampNanos = 0;

	while (true) {
		const tag = reader.readTag();
		if (!tag) break;

		if (tag.field === 1 && tag.wireType === 2) {
			id = reader.readString();
		} else if (tag.field === 2 && tag.wireType === 2) {
			const timestamp = decodeTimestamp(reader.readBytes());
			timestampSec = timestamp.sec;
			timestampNanos = timestamp.nanos;
		} else {
			reader.skip(tag.wireType);
		}
	}

	return { id, timestampSec, timestampNanos };
}

function decodeChat(buf: Uint8Array): DecodedChat | undefined {
	const reader = new ProtoReader(buf);
	const chat: Partial<DecodedChat> = {};

	while (true) {
		const tag = reader.readTag();
		if (!tag) break;

		switch (tag.field) {
			case 1:
				chat.content = reader.readString();
				break;
			case 2:
				chat.name = reader.readString();
				break;
			case 4:
				chat.accountStatus = reader.readVarint();
				break;
			case 5:
				chat.rawUserId = reader.readVarint();
				break;
			case 6:
				chat.hashedUserId = reader.readString();
				break;
			case 8:
				chat.no = reader.readVarint();
				break;
			default:
				reader.skip(tag.wireType);
		}
	}

	if (!chat.content) return undefined;
	return {
		content: chat.content,
		name: chat.name,
		accountStatus: chat.accountStatus ?? 0,
		rawUserId: chat.rawUserId,
		hashedUserId: chat.hashedUserId,
		no: chat.no ?? 0,
	};
}

function decodeNicoliveMessage(buf: Uint8Array): DecodedChat | undefined {
	const reader = new ProtoReader(buf);

	while (true) {
		const tag = reader.readTag();
		if (!tag) break;

		if ((tag.field === 1 || tag.field === 20) && tag.wireType === 2) {
			return decodeChat(reader.readBytes());
		}
		reader.skip(tag.wireType);
	}

	return undefined;
}

function decodeChunkedMessage(
	buf: Uint8Array,
): DecodedChunkedMessage | undefined {
	const reader = new ProtoReader(buf);
	let id: string | undefined;
	let timestampSec = 0;
	let timestampNanos = 0;
	let chat: DecodedChat | undefined;

	while (true) {
		const tag = reader.readTag();
		if (!tag) break;

		if (tag.field === 1 && tag.wireType === 2) {
			const meta = decodeMeta(reader.readBytes());
			id = meta.id;
			timestampSec = meta.timestampSec;
			timestampNanos = meta.timestampNanos;
		} else if (tag.field === 2 && tag.wireType === 2) {
			chat = decodeNicoliveMessage(reader.readBytes());
		} else {
			reader.skip(tag.wireType);
		}
	}

	if (!chat) return undefined;
	return { id, chat, timestampSec, timestampNanos };
}

function openGmBinaryStream(
	url: string,
	onData: (data: Uint8Array) => void,
	onDone: () => void,
	onError: (error: Error) => void,
): GmRequestHandle {
	let processedLength = 0;

	const handleResponse = (response: unknown): void => {
		if (
			!(response instanceof ArrayBuffer) ||
			response.byteLength <= processedLength
		) {
			return;
		}

		const bytes = new Uint8Array(response);
		onData(bytes.subarray(processedLength));
		processedLength = bytes.length;
	};

	return GM_xmlhttpRequest({
		method: "GET",
		url,
		responseType: "arraybuffer",
		onprogress(res) {
			handleResponse(res.response);
		},
		onload(res) {
			if (res.status !== 0 && (res.status < 200 || res.status >= 300)) {
				onError(new Error(`GET ${url} failed: HTTP ${res.status}`));
				return;
			}
			handleResponse(res.response);
			onDone();
		},
		onerror(res) {
			onError(new Error(`GET ${url} failed: status=${res.status}`));
		},
	});
}

function withAt(uri: string, at: string): string {
	const separator = uri.includes("?") ? "&" : "?";
	return `${uri}${separator}at=${encodeURIComponent(at)}`;
}

function replaceAudienceToken(wsUrl: string, audienceToken: unknown): string {
	if (typeof audienceToken !== "string" || audienceToken.length === 0) {
		return wsUrl;
	}

	const url = new URL(wsUrl);
	url.searchParams.set("audience_token", audienceToken);
	return url.toString();
}

class NicoLiveChatClient {
	private readonly liveId: string;
	private readonly onChat: (messages: ChatMessage[]) => void;
	private readonly onError: (error: Error) => void;
	private readonly onConnect: (info: ConnectInfo) => void;

	private alive = false;
	private startedAtUsec = 0;
	private watchWs: WebSocket | null = null;
	private reconnectWsUrl: string | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private entryHandle: GmRequestHandle | null = null;
	private segmentHandle: GmRequestHandle | null = null;
	private viewUri: string | null = null;
	private nextEntryAt = "now";
	private connected = false;
	private receivedInitialSegment = false;

	constructor({
		liveId,
		onChat,
		onError,
		onConnect,
	}: NicoLiveChatClientOptions) {
		if (!liveId) throw new Error("liveId is required");
		this.liveId = liveId;
		this.onChat = onChat ?? (() => undefined);
		this.onError = onError ?? console.error;
		this.onConnect = onConnect ?? (() => undefined);
	}

	async start({ skipExisting = true }: StartOptions = {}): Promise<void> {
		if (this.alive) return;

		this.startedAtUsec = skipExisting ? Date.now() * 1000 : 0;
		this.alive = true;

		try {
			const wsUrl = await getWatchWebSocketUrl(this.liveId);
			if (!this.alive) return;
			this.connectWatchWebSocket(wsUrl, false);
		} catch (error) {
			this.alive = false;
			this.reportError(error);
		}
	}

	stop(): void {
		this.alive = false;

		if (this.reconnectTimer !== null) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		this.watchWs?.close();
		this.watchWs = null;
		this.entryHandle?.abort();
		this.entryHandle = null;
		this.segmentHandle?.abort();
		this.segmentHandle = null;
	}

	private connectWatchWebSocket(wsUrl: string, reconnect: boolean): void {
		const ws = new WebSocket(wsUrl);
		this.watchWs = ws;
		this.reconnectWsUrl = wsUrl;

		ws.addEventListener("open", () => {
			ws.send(JSON.stringify({ type: "startWatching", data: { reconnect } }));
		});

		ws.addEventListener("message", (event) => {
			if (typeof event.data !== "string") return;

			try {
				this.handleWatchMessage(JSON.parse(event.data) as WatchMessage);
			} catch (error) {
				this.reportError(error);
			}
		});

		ws.addEventListener("error", () => {
			this.reportError(new Error("NicoNico watch WebSocket error"));
		});
	}

	private handleWatchMessage(message: WatchMessage): void {
		switch (message.type) {
			case "ping":
				this.sendWatchMessage({ type: "pong" });
				this.sendWatchMessage({ type: "keepSeat" });
				break;
			case "messageServer":
			case "akashicMessageServer":
				this.handleMessageServer(message.data);
				break;
			case "reconnect":
				this.handleReconnect(message.data);
				break;
			case "disconnect":
				this.handleDisconnect(message.data);
				break;
		}
	}

	private handleMessageServer(data: Record<string, unknown> | undefined): void {
		const viewUri = data?.viewUri;
		if (typeof viewUri !== "string" || viewUri.length === 0) return;

		this.viewUri = viewUri;
		this.nextEntryAt = "now";
		this.receivedInitialSegment = false;
		this.connectEntryStream();
	}

	private handleReconnect(data: Record<string, unknown> | undefined): void {
		const currentUrl = this.reconnectWsUrl;
		if (!currentUrl) return;

		const waitTimeSec =
			typeof data?.waitTimeSec === "number" ? data.waitTimeSec : 0;
		const nextUrl = replaceAudienceToken(currentUrl, data?.audienceToken);

		this.watchWs?.close();
		this.reconnectTimer = setTimeout(
			() => {
				if (this.alive) this.connectWatchWebSocket(nextUrl, true);
			},
			Math.max(0, waitTimeSec * 1000),
		);
	}

	private handleDisconnect(data: Record<string, unknown> | undefined): void {
		const reason = data?.reason;
		if (reason === "END_PROGRAM") {
			this.stop();
			return;
		}
		this.reportError(
			new Error(`NicoNico disconnected: ${String(reason ?? "unknown")}`),
		);
	}

	private sendWatchMessage(message: unknown): void {
		if (this.watchWs?.readyState !== WebSocket.OPEN) return;
		this.watchWs.send(JSON.stringify(message));
	}

	private connectEntryStream(): void {
		if (!this.alive || !this.viewUri) return;

		this.entryHandle?.abort();
		const currentAt = this.nextEntryAt;
		const splitter = new SizeDelimitedSplitter();

		this.entryHandle = openGmBinaryStream(
			withAt(this.viewUri, currentAt),
			(data) => {
				try {
					splitter.addData(data);
					for (const chunk of splitter.read()) {
						this.handleEntry(decodeChunkedEntry(chunk));
					}
				} catch (error) {
					this.reportError(error);
				}
			},
			() => {
				if (!this.alive) return;
				if (this.nextEntryAt === currentAt) {
					this.reportError(
						new Error("NicoNico entry stream ended without next cursor"),
					);
					return;
				}
				this.connectEntryStream();
			},
			(error) => this.reportError(error),
		);
	}

	private handleEntry(entry: DecodedEntry): void {
		if (entry.nextAt) this.nextEntryAt = entry.nextAt;

		const uri =
			entry.segmentUri ??
			(!this.receivedInitialSegment ? entry.previousUri : undefined);
		if (!uri) return;

		this.receivedInitialSegment = true;
		this.connectSegmentStream(uri);

		if (!this.connected) {
			this.connected = true;
			this.onConnect({ liveId: this.liveId });
		}
	}

	private connectSegmentStream(segmentUri: string): void {
		if (!this.alive) return;

		this.segmentHandle?.abort();
		const splitter = new SizeDelimitedSplitter();

		this.segmentHandle = openGmBinaryStream(
			segmentUri,
			(data) => {
				try {
					splitter.addData(data);
					const messages: ChatMessage[] = [];

					for (const chunk of splitter.read()) {
						const decoded = decodeChunkedMessage(chunk);
						const message = decoded ? this.toChatMessage(decoded) : undefined;
						if (message) messages.push(message);
					}

					if (messages.length > 0) this.onChat(messages);
				} catch (error) {
					this.reportError(error);
				}
			},
			() => undefined,
			(error) => this.reportError(error),
		);
	}

	private toChatMessage(
		decoded: DecodedChunkedMessage,
	): ChatMessage | undefined {
		const { chat } = decoded;
		if (chat.content.startsWith("/")) return undefined;

		const timestampUsec = String(
			decoded.timestampSec * 1_000_000 +
				Math.floor(decoded.timestampNanos / 1000),
		);
		if (this.startedAtUsec > 0 && Number(timestampUsec) <= this.startedAtUsec) {
			return undefined;
		}

		return {
			id: decoded.id ?? String(chat.no),
			author:
				chat.name ??
				chat.hashedUserId ??
				chat.rawUserId?.toString() ??
				"anonymous",
			message: chat.content,
			timestampUsec,
			isMember: chat.accountStatus > 0,
		};
	}

	private reportError(error: unknown): void {
		this.onError(error instanceof Error ? error : new Error(String(error)));
	}
}

export function subscribeNicoLiveChat(
	options: NicoLiveChatClientOptions,
): () => void {
	const client = new NicoLiveChatClient(options);
	void client.start();
	return () => client.stop();
}
