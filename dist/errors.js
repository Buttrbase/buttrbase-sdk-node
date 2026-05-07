export class ButtrbaseError extends Error {
    statusCode;
    detail;
    payload;
    constructor(statusCode, detail, payload) {
        super(`[${statusCode}] ${detail}`);
        this.statusCode = statusCode;
        this.detail = detail;
        this.payload = payload;
        this.name = 'ButtrbaseError';
    }
}
