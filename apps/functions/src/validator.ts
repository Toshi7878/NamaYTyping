import * as v from "valibot";

const maxUserResults = 500;
const maxFlatWords = 2000;
const maxWordResults = 5000;
const maxStringLength = 500;

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
const wordEvaluationSchema = v.union([
	v.literal("Great"),
	v.literal("Good"),
	v.literal("Skip"),
	v.literal("None"),
]);
const wordResultSchema = v.strictObject({
	inputs: v.pipe(v.array(shortStringSchema), v.maxLength(maxStringLength)),
	evaluation: wordEvaluationSchema,
});
const mapSchema = v.strictObject({
	id: v.pipe(v.string(), v.maxLength(128)),
	mapId: finiteNumberSchema,
	rating: finiteNumberSchema,
	totalNotes: finiteNumberSchema,
	flatWords: v.pipe(
		v.array(v.pipe(v.string(), v.maxLength(100))),
		v.maxLength(maxFlatWords),
	),
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
	wordResults: v.pipe(v.array(wordResultSchema), v.maxLength(maxWordResults)),
	currentWordIndex: finiteNumberSchema,
});
export const saveLiveResultRequestSchema = v.strictObject({
	liveId: safeIdSchema,
	map: mapSchema,
	userResults: v.pipe(v.array(userResultSchema), v.maxLength(maxUserResults)),
});

export type SaveLiveResultRequest = v.InferInput<
	typeof saveLiveResultRequestSchema
>;
