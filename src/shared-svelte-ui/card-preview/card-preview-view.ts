export interface CardPreviewView {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly statsLine: string | null;
  readonly imageUrl: string | null;
  readonly imageAlt: string;
  readonly placeholderLabel: string;
}

export interface CardPreviewPanelProps {
  readonly preview: CardPreviewView | null;
  readonly dataCyPrefix: string;
  readonly emptyLabel: string;
}
