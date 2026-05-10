const PATTERNS = [
  /[?&]v=([a-zA-Z0-9_-]{11})/,
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /studio\.youtube\.com\/video\/([a-zA-Z0-9_-]{11})/,
] as const;

/**
 * YouTube の URL / ID 文字列から動画IDを抽出する
 *
 * 対応形式:
 * - https://www.youtube.com/watch?v=XXXXXXXXXXX
 * - https://studio.youtube.com/live_chat?is_popout=1&v=XXXXXXXXXXX
 * - https://www.youtube.com/live_chat?is_popout=1&v=XXXXXXXXXXX
 * - https://youtu.be/XXXXXXXXXXX
 * - https://www.youtube.com/shorts/XXXXXXXXXXX
 * - https://www.youtube.com/live/XXXXXXXXXXX
 * - https://www.youtube.com/embed/XXXXXXXXXXX
 * - https://studio.youtube.com/video/XXXXXXXXXXX/livestreaming
 * - XXXXXXXXXXX (11文字のIDをそのまま渡した場合)
 */
export function extractYouTubeLiveId(input: string): string | undefined {
  const trimmed = input.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  for (const pattern of PATTERNS) {
    const match = trimmed.match(pattern)?.[1];
    if (match) return match;
  }

  return undefined;
}
