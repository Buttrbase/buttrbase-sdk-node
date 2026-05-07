export class ButtrbaseError extends Error {
  constructor(
    public statusCode: number,
    public detail: string,
    public payload?: unknown,
  ) {
    super(`[${statusCode}] ${detail}`);
    this.name = 'ButtrbaseError';
  }
}
