const WS_URL = "wss://irc-ws.chat.twitch.tv:443";

// ---- Twitch IRC parsing --------------------------------------------------

function parseTags(raw: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) tags[part] = "";
    else tags[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return tags;
}

interface ParsedIrcMessage {
  tags: Record<string, string>;
  prefix: string;
  command: string;
  params: string[];
}

function parseIrcMessage(line: string): ParsedIrcMessage | null {
  let rest = line;
  let tags: Record<string, string> = {};
  let prefix = "";

  if (rest.startsWith("@")) {
    const sp = rest.indexOf(" ");
    if (sp === -1) return null;
    tags = parseTags(rest.slice(1, sp));
    rest = rest.slice(sp + 1);
  }

  if (rest.startsWith(":")) {
    const sp = rest.indexOf(" ");
    if (sp === -1) return null;
    prefix = rest.slice(1, sp);
    rest = rest.slice(sp + 1);
  }

  const trailIdx = rest.indexOf(" :");
  let trail = "";
  if (trailIdx !== -1) {
    trail = rest.slice(trailIdx + 2);
    rest = rest.slice(0, trailIdx);
  }

  const parts = rest.split(" ").filter(Boolean);
  const command = parts[0] ?? "";
  const params = [...parts.slice(1), ...(trail ? [trail] : [])];

  return { tags, prefix, command, params };
}

// ---- Public types --------------------------------------------------------

interface ChatMessage {
  userId: string;
  author: string;
  message: string;
  timestampUsec: string;
  isMember: boolean;
}

export interface ConnectInfo {
  channelName: string;
}

export interface TwitchChatClientOptions {
  channelName: string;
  onChat?: (messages: ChatMessage[]) => void;
  onError?: (error: Error) => void;
  onConnect?: (info: ConnectInfo) => void;
}

export interface StartOptions {
  /** start() 以前のチャットをコールバックしない（デフォルト: true） */
  skipExisting?: boolean;
}

// ---- TwitchLiveChatClient -----------------------------------------------

class TwitchLiveChatClient {
  private readonly _channelName: string;
  private readonly _onChat: (messages: ChatMessage[]) => void;
  private readonly _onError: (error: Error) => void;
  private readonly _onConnect: (info: ConnectInfo) => void;

  private _alive = false;
  private _ws: WebSocket | null = null;
  private _startedAt = 0;

  constructor({
    channelName,
    onChat,
    onError,
    onConnect,
  }: TwitchChatClientOptions) {
    if (!channelName) throw new Error("channelName is required");
    this._channelName = channelName.toLowerCase();
    this._onChat = onChat ?? (() => undefined);
    this._onError = onError ?? console.error;
    this._onConnect = onConnect ?? (() => undefined);
  }

  start({ skipExisting = true }: StartOptions = {}): void {
    if (this._alive) return;
    this._startedAt = skipExisting ? Date.now() * 1000 : 0; // マイクロ秒
    this._alive = true;
    this._connect();
  }

  stop(): void {
    this._alive = false;
    this._ws?.close();
    this._ws = null;
  }

  private _connect(): void {
    const nick = `justinfan${Math.floor(Math.random() * 90000) + 10000}`;
    const ws = new WebSocket(WS_URL);
    this._ws = ws;

    ws.addEventListener("open", () => {
      ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      ws.send(`NICK ${nick}`);
      ws.send(`JOIN #${this._channelName}`);
    });

    ws.addEventListener("message", (event) => {
      const text = typeof event.data === "string" ? event.data : "";
      for (const line of text.split("\r\n")) {
        if (line) this._handleLine(line);
      }
    });

    ws.addEventListener("close", () => {
      if (!this._alive) return;
      setTimeout(() => {
        if (this._alive) this._connect();
      }, 3000);
    });

    ws.addEventListener("error", () => {
      this._onError(new Error("WebSocket error"));
    });
  }

  private _handleLine(line: string): void {
    if (line.startsWith("PING")) {
      this._ws?.send("PONG :tmi.twitch.tv");
      return;
    }

    const msg = parseIrcMessage(line);
    if (!msg) return;

    if (msg.command === "RECONNECT") {
      this._ws?.close();
      return;
    }

    if (msg.command === "JOIN") {
      this._onConnect({ channelName: this._channelName });
      return;
    }

    if (msg.command === "PRIVMSG") {
      const { tags } = msg;
      const timestampMs = tags["tmi-sent-ts"]
        ? Number(tags["tmi-sent-ts"])
        : Date.now();
      const timestampUsec = String(timestampMs * 1000);

      if (Number(timestampUsec) <= this._startedAt) return;

      const chatMsg: ChatMessage = {
        userId: tags["user-id"] ?? crypto.randomUUID(),
        author: tags["display-name"] ?? msg.prefix.split("!")[0] ?? "",
        message: msg.params[1] ?? "",
        timestampUsec,
        isMember: tags["subscriber"] === "1",
      };

      this._onChat([chatMsg]);
    }
  }
}

export function subscribeTwitchLiveChat(
  options: TwitchChatClientOptions,
): () => void {
  const client = new TwitchLiveChatClient(options);
  client.start();
  return () => client.stop();
}
