export const transitions: Readonly<Record<string, Readonly<Record<string, string>>>>;
export function nextStage(stage: string, event: string): string;
export function taskText(markdown: string, stage: string): string;
export function commandStage(args: string[]): string;
