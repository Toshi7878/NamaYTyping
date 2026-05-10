import { orderBy, query, type Unsubscribe } from "firebase/firestore";
import { db } from "../client";
import { fetchCollection, subscribeCollection } from "../firestore";
import type { ResultMapWithResultId, UserResult } from "./model";
import { liveRefs } from "./path";

type SubscribeResultsOptions = {
	liveId: string;
	onError?: (error: Error) => void;
	onNext: (results: ResultMapWithResultId[]) => void;
};

export const subscribeResults = ({
	liveId,
	onError,
	onNext,
}: SubscribeResultsOptions): Unsubscribe =>
	subscribeCollection(
		query(liveRefs.results(db, liveId), orderBy("createdAt", "desc")),
		onNext,
		onError,
	);

export const fetchUserResults = (
	liveId: string,
	resultId: string,
): Promise<UserResult[]> =>
	fetchCollection(liveRefs.resultUsers(db, liveId, resultId));
