import type { UserResult } from "lyrics-ime-typing-engine";

const saveLiveResultEndpoint =
	"https://asia-northeast1-namaytyping.cloudfunctions.net/saveLiveResult";

export type ResultMapInput = {
	id: string;
	mapId: number;
	rating: number;
	totalNotes: number;
	flatWords: string[];
	createdAt: unknown;
	media: {
		previewTime: number;
		thumbnailQuality: "mqdefault" | "maxresdefault";
		videoId: string;
	};
	info: {
		title: string;
		artistName: string;
		source: string;
	};
};

type SaveLiveResultInput = {
	map: ResultMapInput;
	userResults: UserResult[];
};

export const createResultWithUser = async (
	liveId: string,
	input: SaveLiveResultInput,
) => {
	const response = await fetch(saveLiveResultEndpoint, {
		body: JSON.stringify({ liveId, ...input }),
		headers: {
			"Content-Type": "application/json",
		},
		method: "POST",
	});

	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as {
			error?: string;
		} | null;
		throw new Error(
			body?.error ?? `Failed to save live result: ${response.status}`,
		);
	}
};
