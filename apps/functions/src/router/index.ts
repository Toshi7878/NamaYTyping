import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import * as v from "valibot";
import { onRequest } from "../https/on-request.js";
import { saveLiveResultRequestSchema } from "../validator.js";

initializeApp();

const ttlHours = 12;
const createExpireAt = () =>
	Timestamp.fromMillis(Date.now() + ttlHours * 60 * 60 * 1000);

export const saveLiveResult = onRequest(async (req, res) => {
	try {
		const input = v.parse(saveLiveResultRequestSchema, req.body);

		const { liveId, map, userResults } = input;
		const db = getFirestore();
		const resultRef = db.collection(`lives/${liveId}/results`).doc();
		const expireAt = createExpireAt();
		const batch = db.batch();

		batch.set(resultRef, {
			map,
			createdAt: FieldValue.serverTimestamp(),
			expireAt,
		});

		for (const userResult of userResults) {
			batch.set(resultRef.collection("users").doc(userResult.userId), {
				...userResult,
				expireAt,
			});
		}

		await batch.commit();
		res.json({ resultId: resultRef.id });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Invalid request";
		res.status(400).json({ error: message });
	}
});
