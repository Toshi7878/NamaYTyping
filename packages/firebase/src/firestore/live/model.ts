import type {
	FirestoreDataConverter,
	QueryDocumentSnapshot,
	SnapshotOptions,
	Timestamp,
	WithFieldValue,
} from "firebase/firestore";
import type { UserResult as ImeResult } from "lyrics-ime-typing-engine";

export type ResultMap = {
	id: string;
	expireAt: Timestamp;
	map: {
		id: string;
		mapId: number;
		rating: number;
		totalNotes: number;
		flatWords: string[];
		createdAt: Timestamp;
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
};

export type UserResult = {
	userId: string;
	expireAt: Timestamp;
} & ImeResult;

type ResultData = Omit<ResultMap, "id">;

export const resultConverter: FirestoreDataConverter<ResultMap, ResultData> = {
	toFirestore: ({ id: _id, ...data }: WithFieldValue<ResultMap>) => data,
	fromFirestore: (
		snapshot: QueryDocumentSnapshot<ResultData>,
		options: SnapshotOptions,
	) => {
		const data = snapshot.data(options);
		return { id: snapshot.id, ...data };
	},
};

export const userResultConverter: FirestoreDataConverter<
	UserResult,
	UserResult
> = {
	toFirestore: (data: WithFieldValue<UserResult>) => data,
	fromFirestore: (
		snapshot: QueryDocumentSnapshot<UserResult>,
		options: SnapshotOptions,
	) => snapshot.data(options),
};
