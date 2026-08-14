export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const publicError = (error: unknown) => {
  if (error instanceof AppError) {
    return { status: error.status, body: { error: { code: error.code, message: error.message, details: error.details } } };
  }
  return { status: 500, body: { error: { code: 'internal_error', message: 'Die Anfrage konnte nicht verarbeitet werden.' } } };
};
