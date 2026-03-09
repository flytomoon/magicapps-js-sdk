/** Base error class for Magic Apps Cloud SDK errors. */
export class MagicAppsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MagicAppsError";
  }
}

/** Error from the MagicApps API. */
export class ApiError extends MagicAppsError {
  public readonly statusCode: number;
  public readonly responseBody: unknown;

  constructor(statusCode: number, message: string, responseBody?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}
