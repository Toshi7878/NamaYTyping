import { type RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { extractYouTubeLiveId } from "@/utils/extract-youtube-id";
import { usePortalMount } from "@/utils/use-portal-mount";
import {
	type ChatMessage,
	startLiveChat,
} from "@/utils/youtube-live-chat-client";
import { unsafeWindow } from "$";

const STORAGE_KEY = "yt-live-chat-url";

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
	const { isStarted } = useLiveChatSession(
		inputRef,
		onConnect,
		onChat,
		onError,
		onEnd,
	);

	if (isStarted || !mountEl) return null;

	return createPortal(
		<Input
			ref={inputRef}
			defaultValue={sessionStorage.getItem(STORAGE_KEY) ?? ""}
			onChange={(e) => sessionStorage.setItem(STORAGE_KEY, e.target.value)}
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
	const [isStarted, setIsStarted] = useState(false);
	const unsubscribeRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		function startClient(_event: Event) {
			const liveId = extractYouTubeLiveId(inputRef.current?.value.trim() ?? "");
			setIsStarted(true);

			if (!liveId) return;

			unsubscribeRef.current?.();
			unsubscribeRef.current = startLiveChat({
				liveId,
				onChat,
				onConnect,
				onError,
			});
		}

		function handleEnd() {
			setIsStarted(false);
			onEnd();
		}

		const ime = unsafeWindow.__ytyping_ime;
		if (ime) {
			ime.removeEventListener("start", startClient);
			ime.addEventListener("start", startClient);
			ime.removeEventListener("end", handleEnd);
			ime.addEventListener("end", handleEnd);
		}

		return () => {
			unsubscribeRef.current?.();
			unsubscribeRef.current = null;
			const imeOnCleanup = unsafeWindow.__ytyping_ime;
			if (imeOnCleanup) {
				imeOnCleanup.removeEventListener("start", startClient);
				imeOnCleanup.removeEventListener("end", handleEnd);
			}
		};
	}, [inputRef, onChat, onConnect, onError, onEnd]);

	return { isStarted };
};
