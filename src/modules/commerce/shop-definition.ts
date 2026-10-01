import type { ProgressRequirement } from "../progress.ts";
export interface ShopDefinition {
  readonly id: string;
  readonly economyId: string;
  readonly offers: readonly {
    readonly boosterId: string;
    readonly priceDp: number;
    readonly enabled: boolean;
    readonly requiresProgress: readonly ProgressRequirement[];
  }[];
  readonly singles: boolean;
}
