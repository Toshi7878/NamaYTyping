import {
	collection,
	doc,
	serverTimestamp,
	Timestamp,
	writeBatch,
} from "firebase/firestore";
import { db } from "../client";
import type { ResultMap, UserResult } from "./model";
import { livePaths, liveRefs } from "./path";

const ttlHours = 12;

const createExpireAt = () =>
	Timestamp.fromMillis(Date.now() + ttlHours * 60 * 60 * 1000);

type CreateResultWithUserInput = {
	map: ResultMap["map"];
	userResults: Omit<UserResult, "expireAt">[];
};

export const createResultWithUser = async (
	liveId: string,
	input: CreateResultWithUserInput,
) => {
	const resultRef = doc(collection(db, livePaths.results(liveId)));
	const expireAt = createExpireAt();
	const batch = writeBatch(db);
	const { userResults, ...resultInput } = input;

	batch.set(resultRef, {
		...resultInput,
		createdAt: serverTimestamp(),
		expireAt,
	});
	for (const userResult of userResults) {
		batch.set(
			liveRefs.resultUser(db, liveId, resultRef.id, userResult.userId),
			{ ...userResult, expireAt },
		);
	}

	await batch.commit();
};
