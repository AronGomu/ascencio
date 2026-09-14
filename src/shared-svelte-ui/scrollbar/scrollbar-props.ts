export interface OverlayScrollbarProps {
  readonly axis: "horizontal" | "vertical";
  readonly scrollElement: HTMLElement | null;
  readonly contentSizeKey: string | number;
  readonly dataCyPrefix: string;
}
