import { NamaTypingContainer } from "./features/nama-typing/container";
import { ImeModeToggle } from "./features/typing-link-mode";
import { usePathname } from "./utils/spa-navigate";

export default function App() {
	const pathname = usePathname();
	const isImePage = pathname.startsWith("/ime/");

	return (
		<>
			<ImeModeToggle />
			{isImePage && <NamaTypingContainer />}
		</>
	);
}
