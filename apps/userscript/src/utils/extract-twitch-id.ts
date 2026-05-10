const CHANNEL_NAME_PATTERN = /^[a-zA-Z0-9_]{4,25}$/;
const TWITCH_HOST_PATTERN = /(^|\.)twitch\.tv$/i;

/**
 * Extracts a Twitch channel name from a live URL or raw channel name.
 *
 * Supported examples:
 * - https://www.twitch.tv/channel_name
 * - https://twitch.tv/channel_name
 * - https://m.twitch.tv/channel_name
 * - twitch.tv/channel_name
 * - channel_name
 */
export function extractTwitchLiveId(input: string): string | undefined {
  const trimmed = input.trim();

  if (CHANNEL_NAME_PATTERN.test(trimmed)) return trimmed.toLowerCase();

  const normalized = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return undefined;
  }

  if (!TWITCH_HOST_PATTERN.test(url.hostname)) return undefined;

  const channelName = url.pathname.split("/").filter(Boolean)[0];
  if (!channelName || !CHANNEL_NAME_PATTERN.test(channelName)) return undefined;

  return channelName.toLowerCase();
}
