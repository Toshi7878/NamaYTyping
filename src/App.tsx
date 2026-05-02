import { ImeModeToggle } from "./features/ImeModeToggle";
import { NamaTypingContainer } from "./features/nama-typing/container";

interface Props {
	host: HTMLDivElement;
}

export default function App({ host }: Props) {
	return (
		<>
			<ImeModeToggle />
			<NamaTypingContainer host={host} />
		</>
	);
}
