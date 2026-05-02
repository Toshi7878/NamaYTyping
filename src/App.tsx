import { ClientOnly } from "./components/client-only";
import { NamaTypingContainer } from "./features/nama-typing/container";
import { ImeModeToggle } from "./features/typing-link-mode";
import { usePathname } from "./utils/spa-navigate";

interface Props {
	host: HTMLDivElement;
}

export default function App({ host }: Props) {
	const pathname = usePathname();
	const isImePage = pathname.startsWith("/ime/");
	if (!isImePage) return null;
	return (
		<>
			<ClientOnly>
				<ImeModeToggle />
			</ClientOnly>
			{isImePage && <NamaTypingContainer host={host} />}
		</>
	);
}
