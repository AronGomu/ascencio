export type BotHostCall = {
  readonly method:
    "pin" | "nativeOpen" | "nativeRequest" | "nativeClose" | "nativeMemory";
  readonly payload: Record<string, unknown>;
};
