import { type RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { extractYouTubeLiveId } from "@/utils/extract-youtube-id";
import { usePortalMount } from "@/utils/use-portal-mount";
import {
	type ChatMessage,
	YTLiveChatClient,
} from "@/utils/youtube-live-chat-client";
import { unsafeWindow } from "$";

interface ImeLiveChatConnectorProps {
	onConnect: () => void;
	onChat: (messages: ChatMessage[]) => void;
	onError: (error: Error) => void;
	onEnd: () => void;
}

export const ImeLiveChatConnector = ({
	onConnect,
	onChat,
	onError,
	onEnd,
}: ImeLiveChatConnectorProps) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const mountEl = usePortalMount("body", { position: "beforeend" });
	const { isConnected } = useLiveChatSession(
		inputRef,
		onConnect,
		onChat,
		onError,
		onEnd,
	);

	if (isConnected || !mountEl) return null;

	return createPortal(
		<Input
			ref={inputRef}
			placeholder="YouTube Live URL or ID"
			className="w-48 fixed bottom-4 right-4"
			size="sm"
		/>,
		mountEl,
	);
};

const useLiveChatSession = (
	inputRef: RefObject<HTMLInputElement | null>,
	onConnect: () => void,
	onChat: (messages: ChatMessage[]) => void,
	onError: (error: Error) => void,
	onEnd: () => void,
) => {
	const [isConnected, setIsConnected] = useState(false);
	const clientRef = useRef<YTLiveChatClient | null>(null);

	useEffect(() => {
		async function startClient(_event: Event) {
			const liveId = extractYouTubeLiveId(inputRef.current?.value.trim() ?? "");
			setIsConnected(true);

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

		const ime = unsafeWindow.__ytyping_ime;
		if (ime) {
			ime.removeEventListener("start", startClient);
			ime.addEventListener("start", startClient);
			ime.removeEventListener("end", onEnd);
			ime.addEventListener("end", onEnd);
		}

		return () => {
			clientRef.current?.stop();
			clientRef.current = null;
			const imeOnCleanup = unsafeWindow.__ytyping_ime;
			if (imeOnCleanup) {
				imeOnCleanup.removeEventListener("start", startClient);
				imeOnCleanup.removeEventListener("end", onEnd);
			}
		};
	}, [inputRef, onChat, onConnect, onError, onEnd]);

	return { isConnected };
};
