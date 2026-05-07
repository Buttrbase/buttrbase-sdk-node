export declare class ButtrbaseError extends Error {
    statusCode: number;
    detail: string;
    payload?: unknown | undefined;
    constructor(statusCode: number, detail: string, payload?: unknown | undefined);
}
