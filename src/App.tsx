import { ImeModeToggle } from "./features/ImeModeToggle";
import { NamaTypingContainer } from "./features/nama-typing/container";
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
			<ImeModeToggle />
			{isImePage && <NamaTypingContainer host={host} />}
		</>
	);
}
