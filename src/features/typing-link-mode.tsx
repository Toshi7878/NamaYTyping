import { useState } from "react";
import { createPortal } from "react-dom";
import { Switch } from "@/components/ui/switch";
import { usePortalMount } from "@/utils/use-portal-mount";
import { unsafeWindow } from "$";

export const ImeModeToggle = () => {
	const [mode, setMode] = useState<"ime" | "type">(
		unsafeWindow.__ytyping?.getMapLinkMode?.() ?? "type",
	);
	const mountEl = usePortalMount("#right-nav-icons", "afterbegin");
	if (!mountEl) return null;

	const isIme = mode === "ime";
	return createPortal(
		<div className="inline-flex items-center gap-1.5 mx-1">
			<span className="text-[11px] font-semibold text-secondary-foreground tracking-wide min-w-8 text-center select-none">
				{isIme ? "IME" : "TYPE"}
			</span>
			<Switch
				checked={isIme}
				onCheckedChange={(checked) => {
					const newMode = checked ? "ime" : "type";
					setMode(newMode);
					unsafeWindow.__ytyping?.setMapLinkMode?.(newMode);
				}}
			/>
		</div>,
		mountEl,
	);
};
