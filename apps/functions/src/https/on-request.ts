import {
	onRequest as firebaseOnRequest,
	type HttpsFunction,
	type HttpsOptions,
	type Request,
} from "firebase-functions/v2/https";
import { assertRateLimit, getClientIp, RateLimitError } from "./rate-limit.js";

const defaultMaxPayloadBytes = 256 * 1024;
const defaultHttpsOptions = {
	cors: ["https://ytyping.net"],
	region: "asia-northeast1",
} satisfies HttpsOptions;

type Response = Parameters<HttpsFunction>[1];

type RequestHandler = (
	request: Request,
	response: Response,
) => void | Promise<void>;

type LimitedHttpsOptions = HttpsOptions & {
	maxPayloadBytes?: number;
	method?: string;
	rateLimitKey?: (request: Request) => string;
};

type ResolvedLimitOptions = {
	maxPayloadBytes: number;
	method: string;
	rateLimitKey: (request: Request) => string;
};

class PayloadTooLargeError extends Error {
	constructor() {
		super("Payload Too Large");
	}
}

const resolveLimitOptions = (
	options: LimitedHttpsOptions = {},
): ResolvedLimitOptions => ({
	maxPayloadBytes: options.maxPayloadBytes ?? defaultMaxPayloadBytes,
	method: options.method ?? "POST",
	rateLimitKey: options.rateLimitKey ?? getClientIp,
});

const sendMethodNotAllowed = (req: Request, res: Response, method: string) => {
	if (req.method === method) return false;

	res.set("Allow", method);
	res.status(405).json({ error: "Method Not Allowed" });
	return true;
};

const getPayloadSize = (request: Request) => {
	if (Buffer.isBuffer(request.rawBody)) {
		return request.rawBody.byteLength;
	}

	const contentLength = request.get("content-length");
	if (contentLength) return Number.parseInt(contentLength, 10);

	return 0;
};

const assertPayloadSize = (request: Request, maxPayloadBytes: number) => {
	if (getPayloadSize(request) > maxPayloadBytes) {
		throw new PayloadTooLargeError();
	}
};

const handleLimitError = (error: unknown, res: Response) => {
	if (error instanceof PayloadTooLargeError) {
		res.status(413).json({ error: error.message });
		return true;
	}

	if (error instanceof RateLimitError) {
		res.set("Retry-After", String(error.retryAfterSeconds));
		res.status(429).json({ error: error.message });
		return true;
	}

	return false;
};

const wrapRequestHandler = (
	handler: RequestHandler,
	options: LimitedHttpsOptions = {},
): RequestHandler => {
	const limitOptions = resolveLimitOptions(options);

	return async (req, res) => {
		if (sendMethodNotAllowed(req, res, limitOptions.method)) return;

		try {
			assertPayloadSize(req, limitOptions.maxPayloadBytes);
			assertRateLimit(limitOptions.rateLimitKey(req));
		} catch (error) {
			if (handleLimitError(error, res)) return;
			throw error;
		}

		await handler(req, res);
	};
};

export function onRequest(
	options: LimitedHttpsOptions,
	handler: RequestHandler,
): HttpsFunction;
export function onRequest(handler: RequestHandler): HttpsFunction;
export function onRequest(
	optionsOrHandler: LimitedHttpsOptions | RequestHandler,
	handler?: RequestHandler,
) {
	if (typeof optionsOrHandler === "function") {
		return firebaseOnRequest(
			defaultHttpsOptions,
			wrapRequestHandler(optionsOrHandler),
		);
	}

	if (!handler) {
		throw new Error("onRequest handler is required");
	}

	const { maxPayloadBytes, method, rateLimitKey, ...firebaseOptions } =
		optionsOrHandler;
	const limitOptions = { maxPayloadBytes, method, rateLimitKey };

	return firebaseOnRequest(
		{ ...defaultHttpsOptions, ...firebaseOptions },
		wrapRequestHandler(handler, limitOptions),
	);
}
