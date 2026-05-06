import { Input } from "@repo/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/select";
import { type RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { subscribeNiconicoLiveChat } from "@/lib/niconico-live-chat-client";
import { subscribeTwitchLiveChat } from "@/lib/twitch-live-chat-client";
import {
	type ChatMessage,
	subscribeYTLiveChat,
} from "@/lib/youtube-live-chat-client";
import { extractNiconicoLiveId } from "@/utils/extract-niconico-id";
import { extractTwitchLiveId } from "@/utils/extract-twitch-id";
import { extractYouTubeLiveId } from "@/utils/extract-youtube-id";
import { usePortalMount } from "@/utils/use-portal-mount";
import { useWindowProperty } from "@/utils/use-window-property";

const STORAGE_KEY_PLATFORM = "nama-typing:live-chat-platform";
const STORAGE_KEY_YT = "nama-typing:yt-live-chat-url";
const STORAGE_KEY_TWITCH = "nama-typing:twitch-channel-name";
const STORAGE_KEY_NICONICO = "nama-typing:niconico-live-id";

type Platform = "youtube" | "twitch" | "niconico";

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
	const [platform, setPlatform] = useState<Platform>(
		() => (localStorage.getItem(STORAGE_KEY_PLATFORM) as Platform) ?? "youtube",
	);
	const mountEl = usePortalMount("body", { position: "beforeend" });
	const { isStarted } = useLiveChatSession(
		inputRef,
		platform,
		onConnect,
		onChat,
		onError,
	);

	if (isStarted || !mountEl) return null;

	return createPortal(
		<div className="fixed bottom-4 right-4 flex gap-1">
			<Input
				key={platform}
				ref={inputRef}
				defaultValue={getStorageValue(platform)}
				onChange={(e) => setStorageValue(platform, e.target.value)}
				onPaste={(e) => {
					const value = e.clipboardData.getData("text");
					const liveId = extractLiveId(platform, value);
					if (!liveId) return;
					e.preventDefault();
					e.currentTarget.value = liveId;
					setStorageValue(platform, liveId);
				}}
				placeholder={getPlaceholder(platform)}
				className="w-48"
				size="sm"
			/>
			<Select
				value={platform}
				onValueChange={(v) => {
					const p = v as Platform;
					setPlatform(p);
					setStorageValue(p, inputRef.current?.value ?? "");
				}}
			>
				<SelectTrigger size="sm">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="youtube">YouTube</SelectItem>
					<SelectItem value="twitch">Twitch</SelectItem>
					<SelectItem value="niconico">Niconico</SelectItem>
				</SelectContent>
			</Select>
		</div>,
		mountEl,
	);
};

const getStorageValue = (platform: Platform) => {
	switch (platform) {
		case "youtube":
			return sessionStorage.getItem(STORAGE_KEY_YT) ?? "";
		case "twitch":
			return localStorage.getItem(STORAGE_KEY_TWITCH) ?? "";
		case "niconico":
			return sessionStorage.getItem(STORAGE_KEY_NICONICO) ?? "";
	}
};

const setStorageValue = (platform: Platform, value: string) => {
	switch (platform) {
		case "youtube":
			return sessionStorage.setItem(STORAGE_KEY_YT, value);
		case "twitch":
			return localStorage.setItem(STORAGE_KEY_TWITCH, value);
		case "niconico":
			return sessionStorage.setItem(STORAGE_KEY_NICONICO, value);
	}
};

const getPlaceholder = (platform: Platform) => {
	switch (platform) {
		case "youtube":
			return "YouTube Live URL or ID";
		case "twitch":
			return "Twitch channel name";
		case "niconico":
			return "Niconico Live URL or ID";
	}
};

const extractLiveId = (platform: Platform, value: string) => {
	switch (platform) {
		case "youtube":
			return extractYouTubeLiveId(value);
		case "twitch":
			return extractTwitchLiveId(value);
		case "niconico":
			return extractNiconicoLiveId(value);
	}
};

const useLiveChatSession = (
	inputRef: RefObject<HTMLInputElement | null>,
	platform: Platform,
	onConnect: () => void,
	onChat: (messages: ChatMessage[]) => void,
	onError: (error: Error) => void,
) => {
	const [isStarted, setIsStarted] = useState(false);
	const unsubscribeRef = useRef<(() => void) | null>(null);
	const ime = useWindowProperty("__ytyping_ime");
	const platformRef = useRef(platform);
	platformRef.current = platform;

	useEffect(() => {
		if (!ime) return;

		function startClient(_event: Event) {
			const rawValue = inputRef.current?.value ?? "";
			setIsStarted(true);

			unsubscribeRef.current?.();

			switch (platformRef.current) {
				case "youtube": {
					const liveId = extractYouTubeLiveId(rawValue);
					if (!liveId) return;
					unsubscribeRef.current = subscribeYTLiveChat({
						liveId,
						onChat,
						onConnect,
						onError,
					});
					break;
				}
				case "twitch": {
					const channelName = extractTwitchLiveId(rawValue);
					if (!channelName) return;
					unsubscribeRef.current = subscribeTwitchLiveChat({
						channelName,
						onChat,
						onConnect,
						onError,
					});
					break;
				}
				case "niconico": {
					const liveId = extractNiconicoLiveId(rawValue);
					if (!liveId) return;
					unsubscribeRef.current = subscribeNiconicoLiveChat({
						liveId,
						onChat,
						onConnect,
						onError,
					});
					break;
				}
			}
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
