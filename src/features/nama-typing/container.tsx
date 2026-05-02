import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { useImeSession } from "./useImeSession";

interface Props {
	host: HTMLDivElement;
}

export function NamaTypingContainer({ host }: Props) {
	const inputRef = useRef<HTMLInputElement>(null);
	const { visible } = useImeSession(host, inputRef);

	if (!visible) return null;

	return <Input ref={inputRef} placeholder="YouTube Live URL or ID" />;
}
