import { type RefObject, useEffect, useRef, useState } from "react";
import { unsafeWindow } from "$";
import { YTLiveChatClient } from "@/utils/youtube-live-chat-client";
import { extractYouTubeLiveId } from "@/utils/extract-youtube-id";
import { SPANavigate } from "@/utils/spa-navigate";

interface ChatState {
	author: string;
	currentWordIndex: number;
	typeCount: number;
	wordResults: unknown[];
}

export function useImeSession(
	host: HTMLDivElement,
	inputRef: RefObject<HTMLInputElement | null>,
) {
	const [visible, setVisible] = useState(false);
	const clientRef = useRef<YTLiveChatClient | null>(null);
	const chatStatesRef = useRef(new Map<string, ChatState>());
	const observerRef = useRef<MutationObserver | null>(null);

	useEffect(() => {
		function getChatState(author: string): ChatState {
			if (!chatStatesRef.current.has(author)) {
				const initWordResults =
					unsafeWindow.__ytyping_ime?.getBuiltMap()?.initWordResults ?? [];
				chatStatesRef.current.set(author, {
					author,
					currentWordIndex: 0,
					typeCount: 0,
					wordResults: initWordResults,
				});
			}
			return chatStatesRef.current.get(author)!;
		}

		// EventListener 互換シグネチャ（_event は意図的に未使用）
		async function startClient(_event: Event) {
			const liveId = extractYouTubeLiveId(
				inputRef.current?.value.trim() ?? "",
			);
			setVisible(false);
			observerRef.current?.disconnect();
			observerRef.current = null;

			if (!liveId) return;

			clientRef.current?.stop();
			chatStatesRef.current.clear();

			const client = new YTLiveChatClient({
				liveId,
				onChat(messages) {
					for (const m of messages) {
						const state = getChatState(m.author);
						const result = unsafeWindow.__ytyping_ime?.evaluateImeInput({
							value: m.message,
							currentWordIndex: state.currentWordIndex,
							wordResults: state.wordResults,
						});
						if (!result) continue;

						const newWordResults = [...state.wordResults];
						for (const { index, result: wordResult } of result.wordResultUpdates) {
							newWordResults[index] = wordResult;
						}
						chatStatesRef.current.set(m.author, {
							...state,
							currentWordIndex:
								result.nextWordIndex ?? state.currentWordIndex,
							typeCount: state.typeCount + result.typeCountDelta,
							wordResults: newWordResults,
						});
						unsafeWindow.__ytyping_ime?.addNotifications(
							result.notificationsToAppend.map((n) => `${m.author}: ${n}`),
						);
					}
				},
				onConnect: () =>
					unsafeWindow.__ytyping?.toast.success("接続に成功しました"),
				onError: (e) =>
					unsafeWindow.__ytyping?.toast.error(`接続エラー: ${e.message}`),
			});

			clientRef.current = client;
			await client.start();
		}

		function onEnd(_event: Event) {
			chatStatesRef.current.forEach(({ author, typeCount }) => {
				unsafeWindow.__ytyping_ime?.addUserResult({ name: author, typeCount });
			});
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
			setVisible(true);
			startObserver();
		}

		function leave() {
			clientRef.current?.stop();
			clientRef.current = null;
			setVisible(false);
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
	}, [host, inputRef]);

	return { visible };
}
