import type { ChatMessage } from "./container";

const STORAGE_KEY_NICO_NAMES = "nama-typing:nico-names";

type NicoNameMap = { [id: string]: string };

function getNicoNames(): NicoNameMap {
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY_NICO_NAMES) ?? "{}",
    ) as NicoNameMap;
  } catch {
    return {};
  }
}

export function getNicoName(message: ChatMessage): string {
  try {
    const map = JSON.parse(
      localStorage.getItem(STORAGE_KEY_NICO_NAMES) ?? "{}",
    ) as NicoNameMap;
    return map[message.author] ?? message.author;
  } catch {
    return message.author;
  }
}

export function setNicoName(uid: string, name: string): void {
  const names = getNicoNames();
  names[uid] = name;
  localStorage.setItem(STORAGE_KEY_NICO_NAMES, JSON.stringify(names));
}
