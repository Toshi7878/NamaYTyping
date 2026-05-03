/**
 * Shadow DOM を持つ host 要素を生成して `document.documentElement` に追加する。
 * @param styles - Shadow DOM 内に注入する CSS 文字列
 * @returns `host`（Shadow DOM のルート要素）と `mountPoint`（React のマウント先）
 */
export function createShadowRoot(styles: string): {
	host: HTMLDivElement;
	mountPoint: HTMLDivElement;
} {
	const host = document.createElement("div");

	const shadow = host.attachShadow({ mode: "open" });

	const styleEl = document.createElement("style");
	styleEl.textContent = styles;
	shadow.appendChild(styleEl);

	const mountPoint = document.createElement("div");
	shadow.appendChild(mountPoint);

	document.documentElement.appendChild(host);

	return { host, mountPoint };
}
