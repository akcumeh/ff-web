import type { ErrorRequestHandler, RequestHandler } from "express";
import type { ApiError, ErrorCode } from "@ff/shared";

export class HttpError extends Error {
    status: number;
    code: ErrorCode;
    details: { path: string; message: string }[] | undefined;

    constructor(status: number, code: ErrorCode, message: string, details?: { path: string; message: string }[]) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

function body(code: ErrorCode, message: string, details?: { path: string; message: string }[]): ApiError {
    return { error: details ? { code, message, details } : { code, message } };
}

export const notFound: RequestHandler = (_req, res) => {
    res.status(404).json(body("not_found", "Not found."));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    if (err instanceof HttpError) {
        res.status(err.status).json(body(err.code, err.message, err.details));
        return;
    }
    if (err?.type === "entity.too.large") {
        res.status(413).json(body("too_large", "The request body is too large."));
        return;
    }
    if (typeof err?.status === "number" && err.status >= 400 && err.status < 500) {
        res.status(400).json(body("validation_failed", "The request body could not be read."));
        return;
    }
    console.error(JSON.stringify({ level: "error", requestId: res.locals.requestId, path: req.path, error: String(err?.message ?? err) }));
    res.status(500).json(body("internal", "Something went wrong."));
};
