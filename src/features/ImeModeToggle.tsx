import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Switch } from "@/components/ui/switch";
import { unsafeWindow } from "$";

const STORAGE_KEY = "mapLinkMode";

function readMode(): "ime" | "type" {
	try {
		return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "") === "ime"
			? "ime"
			: "type";
	} catch {
		return "type";
	}
}

export function ImeModeToggle() {
	const [mode, setMode] = useState<"ime" | "type">(readMode);
	const mountRef = useRef<HTMLDivElement | null>(null);
	const [, forceUpdate] = useState(0);

	useEffect(() => {
		function tryMount() {
			const navIcons = document.getElementById("right-nav-icons");
			if (!navIcons || mountRef.current?.isConnected) return;

			const div = document.createElement("div");
			div.id = "yt-ime-toggle-mount";
			div.style.display = "contents";
			navIcons.insertBefore(div, navIcons.firstChild);
			mountRef.current = div;
			forceUpdate((n) => n + 1);
		}

		tryMount();

		const observer = new MutationObserver(() => {
			if (!mountRef.current?.isConnected) mountRef.current = null;
			tryMount();
		});
		observer.observe(document.body, { childList: true, subtree: true });

		return () => {
			observer.disconnect();
			mountRef.current?.remove();
			mountRef.current = null;
		};
	}, []);

	function handleChange(checked: boolean) {
		const newMode = checked ? "ime" : "type";
		setMode(newMode);
		unsafeWindow.__ytyping?.setMapLinkMode?.(newMode);
	}

	if (!mountRef.current) return null;

	const isIme = mode === "ime";

	return ReactDOM.createPortal(
		<div className="inline-flex items-center gap-1.5 mx-1">
			<span className="text-[11px] font-semibold text-secondary-foreground tracking-wide min-w-8 text-center select-none">
				{isIme ? "IME" : "TYPE"}
			</span>
			<Switch checked={isIme} onCheckedChange={handleChange} />
		</div>,
		mountRef.current,
	);
}
