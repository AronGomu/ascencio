export interface BotTransport {
  request(value: unknown): Promise<unknown>;
  close(): void;
  memoryBytes?(): Promise<number | null>;
}
export interface BotTransportMetrics {
  computationMs: number;
  roundtripMs: number;
  memoryBytes: number;
}
export const BOT_DEADLINE_MS = 2000;
export const BOT_SETUP_DEADLINE_MS = 15000;
export const BOT_MAX_INPUT_BYTES = 64 * 1024 * 1024;
