import { initializeApp } from "firebase-admin/app";
import {
	FieldValue,
	Timestamp,
	getFirestore,
} from "firebase-admin/firestore";
import { type Request, onRequest } from "firebase-functions/v2/https";
import * as v from "valibot";

initializeApp();

const ttlHours = 12;
const maxUserResults = 500;
const maxFlatWords = 2000;
const maxWordResults = 2000;
const maxStringLength = 500;
const maxPayloadBytes = 256 * 1024;
const rateLimitWindowMs = 60 * 1000;
const maxRequestsPerWindow = 10;
const maxRateLimitEntries = 5000;

type RateLimitBucket = {
	count: number;
	resetAt: number;
};

class HttpError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly retryAfterSeconds?: number,
	) {
		super(message);
	}
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();

const createExpireAt = () =>
	Timestamp.fromMillis(Date.now() + ttlHours * 60 * 60 * 1000);

const finiteNumberSchema = v.pipe(v.number(), v.finite());
const safeIdSchema = v.pipe(
	v.string(),
	v.minLength(1),
	v.maxLength(128),
	v.check((value) => !value.includes("/"), "Invalid id"),
);
const shortStringSchema = v.pipe(v.string(), v.maxLength(maxStringLength));
const thumbnailQualitySchema = v.union([
	v.literal("mqdefault"),
	v.literal("maxresdefault"),
]);
const mapSchema = v.strictObject({
	id: v.pipe(v.string(), v.maxLength(128)),
	mapId: finiteNumberSchema,
	rating: finiteNumberSchema,
	totalNotes: finiteNumberSchema,
	flatWords: v.pipe(
		v.array(v.pipe(v.string(), v.maxLength(100))),
		v.maxLength(maxFlatWords),
	),
	createdAt: v.unknown(),
	media: v.strictObject({
		previewTime: finiteNumberSchema,
		thumbnailQuality: thumbnailQualitySchema,
		videoId: v.pipe(v.string(), v.maxLength(128)),
	}),
	info: v.strictObject({
		title: shortStringSchema,
		artistName: shortStringSchema,
		source: shortStringSchema,
	}),
});
const userResultSchema = v.strictObject({
	userId: safeIdSchema,
	name: v.pipe(v.string(), v.maxLength(100)),
	typeCount: finiteNumberSchema,
	wordResults: v.pipe(v.array(v.unknown()), v.maxLength(maxWordResults)),
	currentWordIndex: finiteNumberSchema,
});
const saveLiveResultRequestSchema = v.strictObject({
	liveId: safeIdSchema,
	map: mapSchema,
	userResults: v.pipe(v.array(userResultSchema), v.maxLength(maxUserResults)),
});

const getClientIp = (req: Request) => {
	const forwardedFor = req.get("x-forwarded-for");
	if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? "unknown";
	return req.ip ?? "unknown";
};

const getPayloadSize = (body: unknown) => {
	const json = JSON.stringify(body);
	return Buffer.byteLength(json ?? "", "utf8");
};

function assertPayloadSize(body: unknown) {
	if (getPayloadSize(body) > maxPayloadBytes) {
		throw new HttpError("Payload Too Large", 413);
	}
}

const pruneRateLimitBuckets = (now: number) => {
	if (rateLimitBuckets.size <= maxRateLimitEntries) return;

	for (const [key, bucket] of rateLimitBuckets) {
		if (bucket.resetAt <= now) {
			rateLimitBuckets.delete(key);
		}
	}
};

function assertRateLimit({ ip, liveId }: { ip: string; liveId: string }) {
	const now = Date.now();
	const key = `${ip}:${liveId}`;
	const bucket = rateLimitBuckets.get(key);

	if (!bucket || bucket.resetAt <= now) {
		rateLimitBuckets.set(key, {
			count: 1,
			resetAt: now + rateLimitWindowMs,
		});
		pruneRateLimitBuckets(now);
		return;
	}

	bucket.count += 1;
	if (bucket.count > maxRequestsPerWindow) {
		throw new HttpError(
			"Too Many Requests",
			429,
			Math.ceil((bucket.resetAt - now) / 1000),
		);
	}
}

export const saveLiveResult = onRequest(
	{
		cors: ["https://ytyping.net"],
		region: "asia-northeast1",
	},
	async (req, res) => {
		if (req.method !== "POST") {
			res.set("Allow", "POST");
			res.status(405).json({ error: "Method Not Allowed" });
			return;
		}

		try {
			assertPayloadSize(req.body);
			const input = v.parse(saveLiveResultRequestSchema, req.body);
			assertRateLimit({
				ip: getClientIp(req),
				liveId: input.liveId,
			});

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
			const status = error instanceof HttpError ? error.status : 400;
			if (error instanceof HttpError && error.retryAfterSeconds !== undefined) {
				res.set("Retry-After", String(error.retryAfterSeconds));
			}
			res.status(status).json({ error: message });
		}
	},
);
