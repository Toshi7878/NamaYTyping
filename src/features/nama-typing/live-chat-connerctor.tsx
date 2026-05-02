import { type RefObject, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { extractYouTubeLiveId } from "@/utils/extract-youtube-id";
import { SPANavigate } from "@/utils/spa-navigate";
import {
	type ChatMessage,
	YTLiveChatClient,
} from "@/utils/youtube-live-chat-client";
import { unsafeWindow } from "$";

interface Props {
	host: HTMLDivElement;
	onConnect: () => void;
	onChat: (messages: ChatMessage[]) => void;
	onError: (error: Error) => void;
	onEnd: () => void;
}

export function LiveChatConnector({
	host,
	onConnect,
	onChat,
	onError,
	onEnd,
}: Props) {
	const inputRef = useRef<HTMLInputElement>(null);
	const { isOnImePage, isConnected } = useLiveChatSession(
		host,
		inputRef,
		onConnect,
		onChat,
		onError,
		onEnd,
	);

	if (!isOnImePage || isConnected) return null;

	return <Input ref={inputRef} placeholder="YouTube Live URL or ID" />;
}

export function useLiveChatSession(
	host: HTMLDivElement,
	inputRef: RefObject<HTMLInputElement | null>,
	onConnect: () => void,
	onChat: (messages: ChatMessage[]) => void,
	onError: (error: Error) => void,
	onEnd: () => void,
) {
	const [isOnImePage, setIsOnImePage] = useState(false);
	const [isConnected, setIsConnected] = useState(false);
	const clientRef = useRef<YTLiveChatClient | null>(null);
	const observerRef = useRef<MutationObserver | null>(null);

	useEffect(() => {
		async function startClient(_event: Event) {
			const liveId = extractYouTubeLiveId(inputRef.current?.value.trim() ?? "");
			setIsConnected(true);
			observerRef.current?.disconnect();
			observerRef.current = null;

			if (!liveId) return;

			clientRef.current?.stop();

			const client = new YTLiveChatClient({
				liveId,
				onChat,
				onConnect,
				onError,
			});

			clientRef.current = client;
			await client.start();
		}

		function setupImeListeners() {
			const ime = unsafeWindow.__ytyping_ime;
			if (!ime) return;
			ime.removeEventListener("start", startClient);
			ime.addEventListener("start", startClient);
			ime.removeEventListener("end", onEnd);
			ime.addEventListener("end", onEnd);
		}

		function startObserver() {
			const obs = new MutationObserver(() => {
				if (!host.isConnected) document.documentElement.appendChild(host);
			});
			obs.observe(document.documentElement, { childList: true, subtree: true });
			observerRef.current = obs;
		}

		function enter() {
			setupImeListeners();
			setIsOnImePage(true);
			setIsConnected(false);
			startObserver();
		}

		function leave() {
			clientRef.current?.stop();
			clientRef.current = null;
			setIsOnImePage(false);
			setIsConnected(false);
			observerRef.current?.disconnect();
			observerRef.current = null;
		}

		function handleNavigate({ pathname }: { pathname: string }) {
			if (pathname.startsWith("/ime/")) {
				enter();
			} else {
				leave();
			}
		}

		// SPA 経由でない直接アクセス時の初期化
		if (location.pathname.startsWith("/ime/")) enter();

		SPANavigate.on(handleNavigate);

		return () => {
			SPANavigate.off(handleNavigate);
			leave();
		};
	}, [host, inputRef, onChat, onConnect, onError, onEnd]);

	return { isOnImePage, isConnected };
}
