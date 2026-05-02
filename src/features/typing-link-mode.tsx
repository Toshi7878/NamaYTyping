import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { Switch } from "@/components/ui/switch";
import { usePortalMount } from "@/utils/use-portal-mount";
import { unsafeWindow } from "$";

const getInitialMode = () => {
	try {
		const stored = unsafeWindow.sessionStorage.getItem("mapLinkMode");
		return JSON.parse(stored ?? "null") === "ime" ? "ime" : "type";
	} catch {
		return "type";
	}
};

export const ImeModeSwitch = () => {
	const id = useId();
	const [mode, setMode] = useState<"ime" | "type">(getInitialMode());
	const mountEl = usePortalMount("#right-nav-icons", {
		position: "afterbegin",
	});

	if (!mountEl) return null;

	const isIme = mode === "ime";
	return createPortal(
		<label
			htmlFor={id}
			className="inline-flex items-center gap-1 mx-1 cursor-pointer group"
		>
			<span className="text-xs font-semibold text-header-foreground/80 group-hover:text-header-foreground tracking-wide min-w-8 text-center select-none">
				{isIme ? "IME" : "TYPE"}
			</span>
			<Switch
				id={id}
				checked={isIme}
				onCheckedChange={(checked) => {
					const newMode = checked ? "ime" : "type";
					setMode(newMode);
					unsafeWindow.__ytyping?.setMapLinkMode?.(newMode);
				}}
			/>
		</label>,
		mountEl,
	);
};
