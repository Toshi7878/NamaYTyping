const LIVE_ID_PATTERN = /^lv\d+$/;
const NICONICO_HOST_PATTERN = /(^|\.)nicovideo\.jp$/i;

/**
 * Extracts a Niconico Live ID from a live URL or raw ID.
 *
 * Supported examples:
 * - https://live.nicovideo.jp/watch/lv123456789
 * - https://live2.nicovideo.jp/watch/lv123456789
 * - live.nicovideo.jp/watch/lv123456789
 * - lv123456789
 */
export function extractNiconicoLiveId(input: string): string | undefined {
	const trimmed = input.trim();

	if (LIVE_ID_PATTERN.test(trimmed)) return trimmed;

	const normalized = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
		? trimmed
		: `https://${trimmed}`;

	let url: URL;
	try {
		url = new URL(normalized);
	} catch {
		return undefined;
	}

	if (!NICONICO_HOST_PATTERN.test(url.hostname)) return undefined;

	const [, page, liveId] = url.pathname.split("/");
	if (page !== "watch" || !liveId || !LIVE_ID_PATTERN.test(liveId)) {
		return undefined;
	}

	return liveId;
}
