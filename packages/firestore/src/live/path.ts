import type { Firestore } from "firebase/firestore";

import { typedCollection, typedDoc } from "../firestore";
import { resultConverter, userResultConverter } from "./model";

export const livePaths = {
	lives: () => "lives",
	live: (liveId: string) => `${livePaths.lives()}/${liveId}`,
	results: (liveId: string) => `${livePaths.live(liveId)}/results`,
	result: (liveId: string, resultId: string) => `${livePaths.results(liveId)}/${resultId}`,
	resultUsers: (liveId: string, resultId: string) => `${livePaths.result(liveId, resultId)}/users`,
	resultUser: (liveId: string, resultId: string, userId: string) => `${livePaths.resultUsers(liveId, resultId)}/${userId}`,
};

export const liveRefs = {
	results: (db: Firestore, liveId: string) => typedCollection(db, livePaths.results(liveId), resultConverter),
	result: (db: Firestore, liveId: string, resultId: string) => typedDoc(db, livePaths.result(liveId, resultId), resultConverter),
	resultUsers: (db: Firestore, liveId: string, resultId: string) =>
		typedCollection(db, livePaths.resultUsers(liveId, resultId), userResultConverter),
	resultUser: (db: Firestore, liveId: string, resultId: string, userId: string) =>
		typedDoc(db, livePaths.resultUser(liveId, resultId, userId), userResultConverter),
};
