export type ProgressiveErrorCode =
  | "CONTENT_SOURCE_STALE"
  | "CONTENT_INVALID_MANIFEST"
  | "CONTENT_PREVIOUS_RELEASE_REQUIRED"
  | "PUBLISH_CONFLICT"
  | "PUBLISH_IMMUTABLE_CONFLICT"
  | "PUBLISH_NETWORK_FAILED"
  | "PUBLISH_APPROVAL_REQUIRED"
  | "PUBLISH_SEMANTIC_VALIDATION_REQUIRED";

export class ProgressiveError extends Error {
  readonly code: ProgressiveErrorCode;

  constructor(code: ProgressiveErrorCode) {
    super(code);
    this.name = "ProgressiveError";
    this.code = code;
  }
}

export function progressiveFail(code: ProgressiveErrorCode): never {
  throw new ProgressiveError(code);
}
