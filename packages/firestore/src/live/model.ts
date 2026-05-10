import type { SaveLiveResultRequest } from "@repo/functions";
import type {
	FirestoreDataConverter,
	QueryDocumentSnapshot,
	SnapshotOptions,
	Timestamp,
	WithFieldValue,
} from "firebase/firestore";

export type ResultMapWithResultId = SaveLiveResultRequest["map"];

export type UserResult = {
	userId: string;
	expireAt: Timestamp;
} & SaveLiveResultRequest["userResults"];

type ResultMap = Omit<ResultMapWithResultId, "id">;

export const resultConverter: FirestoreDataConverter<
	ResultMapWithResultId,
	ResultMap
> = {
	toFirestore: ({ id: _id, ...data }: WithFieldValue<ResultMapWithResultId>) =>
		data,
	fromFirestore: (
		snapshot: QueryDocumentSnapshot<ResultMap>,
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
