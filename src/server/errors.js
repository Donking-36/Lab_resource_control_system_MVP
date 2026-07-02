const DEFAULT_CODES = {
  400: "BAD_REQUEST",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  500: "INTERNAL_ERROR",
};

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || DEFAULT_CODES[status] || "ERROR";
  }
}

module.exports = {
  HttpError,
  DEFAULT_CODES,
};
