import { useEffect, useState } from "react";

/**
 * @param selector - 挿入先を特定する CSS セレクター
 * @param position - 挿入位置
 *   - `"beforebegin"` : 対象要素の直前（兄弟として）
 *   - `"afterbegin"`  : 対象要素の子の先頭
 *   - `"beforeend"`   : 対象要素の子の末尾
 *   - `"afterend"`    : 対象要素の直後（兄弟として）
 * @returns 挿入した `div`。対象要素が未検出の間は `null`
 */
export function usePortalMount(
	selector: string,
	position: InsertPosition,
): HTMLDivElement | null {
	const [mountEl, setMountEl] = useState<HTMLDivElement | null>(null);

	useEffect(() => {
		let el: HTMLDivElement | null = null;

		function tryMount() {
			const target = document.querySelector(selector);
			if (!target || el?.isConnected) return;

			const div = document.createElement("div");
			div.style.display = "contents";
			target.insertAdjacentElement(position, div);
			el = div;
			setMountEl(div);
		}

		tryMount();

		const observer = new MutationObserver(() => {
			if (!el?.isConnected) {
				el = null;
				setMountEl(null);
			}
			tryMount();
		});
		observer.observe(document.body, { childList: true, subtree: true });

		return () => {
			observer.disconnect();
			el?.remove();
			el = null;
			setMountEl(null);
		};
	}, [selector, position]);

	return mountEl;
}
