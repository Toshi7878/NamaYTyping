import { type RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { extractYouTubeLiveId } from "@/utils/extract-youtube-id";
import { usePortalMount } from "@/utils/use-portal-mount";
import { useWindowProperty } from "@/utils/use-window-property";
import {
	type ChatMessage,
	startLiveChat,
} from "@/utils/youtube-live-chat-client";
import { Input } from "@repo/ui";

const STORAGE_KEY = "yt-live-chat-url";

interface ImeLiveChatConnectorProps {
	onConnect: () => void;
	onChat: (messages: ChatMessage[]) => void;
	onError: (error: Error) => void;
}

export const ImeLiveChatConnector = ({
	onConnect,
	onChat,
	onError,
}: ImeLiveChatConnectorProps) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const mountEl = usePortalMount("body", { position: "beforeend" });
	const { isStarted } = useLiveChatSession(
		inputRef,
		onConnect,
		onChat,
		onError,
	);

	if (isStarted || !mountEl) return null;

	return createPortal(
		<Input
			ref={inputRef}
			defaultValue={sessionStorage.getItem(STORAGE_KEY) ?? ""}
			onChange={(e) => sessionStorage.setItem(STORAGE_KEY, e.target.value)}
			onPaste={(e) => {
				const liveId = extractYouTubeLiveId(e.clipboardData.getData("text"));
				if (!liveId) return;
				e.preventDefault();
				e.currentTarget.value = liveId;
				sessionStorage.setItem(STORAGE_KEY, liveId);
			}}
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
) => {
	const [isStarted, setIsStarted] = useState(false);
	const unsubscribeRef = useRef<(() => void) | null>(null);
	const ime = useWindowProperty("__ytyping_ime");

	useEffect(() => {
		if (!ime) return;

		function startClient(_event: Event) {
			const rawValue = inputRef.current?.value ?? "";
			const liveId = extractYouTubeLiveId(rawValue);
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
		}

		ime.removeEventListener("start", startClient);
		ime.addEventListener("start", startClient);
		ime.removeEventListener("end", handleEnd);
		ime.addEventListener("end", handleEnd);

		return () => {
			unsubscribeRef.current?.();
			unsubscribeRef.current = null;
			ime.removeEventListener("start", startClient);
			ime.removeEventListener("end", handleEnd);
		};
	}, [ime, inputRef, onChat, onConnect, onError]);

	return { isStarted };
};
