import { useEffect, useState } from "react";
import styles from "@/index.css?inline";

const styleSheetCache = new Map<string, CSSStyleSheet>();

function getStyleSheet(css: string): CSSStyleSheet {
	if (!styleSheetCache.has(css)) {
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(css);
		styleSheetCache.set(css, sheet);
	}
	// biome-ignore lint/style/noNonNullAssertion: <>
	return styleSheetCache.get(css)!;
}

function attachShadowWithStyles(host: HTMLDivElement): ShadowRoot {
	const shadow = host.attachShadow({ mode: "open" });
	shadow.adoptedStyleSheets = [getStyleSheet(styles)];
	return shadow;
}

/**
 * @param selector - 挿入先を特定する CSS セレクター
 * @param options.position - 挿入位置を指定すると Shadow DOM ホストを生成してスタイルを注入する。
 *   - `"beforebegin"` : 対象要素の直前（兄弟として）
 *   - `"afterbegin"`  : 対象要素の子の先頭
 *   - `"beforeend"`   : 対象要素の子の末尾
 *   - `"afterend"`    : 対象要素の直後（兄弟として）
 * @returns マウント先の要素。対象要素が未検出の間は `null`
 */
export function usePortalMount(
	selector: string,
	options: { position: InsertPosition },
): Element | ShadowRoot | null {
	const position = options?.position;
	const [mountEl, setMountEl] = useState<Element | ShadowRoot | null>(null);

	useEffect(() => {
		if (position !== undefined) {
			let host: HTMLDivElement | null = null;
			let shadow: ShadowRoot | null = null;

			function update() {
				const target = document.querySelector(selector);
				if (!target) {
					setMountEl(null);
					return;
				}
				if (host?.isConnected) return;

				if (!host) {
					host = document.createElement("div");
					shadow = attachShadowWithStyles(host);
				}
				target.insertAdjacentElement(position, host);
				setMountEl(shadow);
			}

			update();

			const observer = new MutationObserver(update);
			observer.observe(document.body, { childList: true, subtree: true });

			return () => {
				observer.disconnect();
				host?.remove();
				setMountEl(null);
			};
		}

		function update() {
			setMountEl(document.querySelector(selector));
		}

		update();

		const observer = new MutationObserver(update);
		observer.observe(document.body, { childList: true, subtree: true });

		return () => observer.disconnect();
	}, [selector, position]);

	return mountEl;
}
