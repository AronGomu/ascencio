export type AuthoringResult<T> =
  | { readonly kind: "ok"; readonly value: T }
  | {
      readonly kind: "failed";
      readonly code: "CONTENT_INVALID_MANIFEST";
      readonly packId: null;
      readonly path: null;
    };
