import { hasOcgType, OCG_TYPE } from "./catalog/ocg-mask.js";

export type CardFrame =
  | "normal"
  | "effect"
  | "ritual"
  | "fusion"
  | "synchro"
  | "xyz"
  | "link"
  | "spell"
  | "trap";

export function cardFrameOf(rawType: number): CardFrame {
  if (hasOcgType(rawType, OCG_TYPE.SPELL)) return "spell";
  if (hasOcgType(rawType, OCG_TYPE.TRAP)) return "trap";
  if (hasOcgType(rawType, OCG_TYPE.LINK)) return "link";
  if (hasOcgType(rawType, OCG_TYPE.XYZ)) return "xyz";
  if (hasOcgType(rawType, OCG_TYPE.SYNCHRO)) return "synchro";
  if (hasOcgType(rawType, OCG_TYPE.FUSION)) return "fusion";
  if (hasOcgType(rawType, OCG_TYPE.RITUAL)) return "ritual";
  if (hasOcgType(rawType, OCG_TYPE.EFFECT)) return "effect";
  return "normal";
}

export const CARD_FRAME_COLORS: Readonly<Record<CardFrame, string>> = {
  normal: "#b8985a",
  effect: "#c26a3d",
  ritual: "#4a6fb5",
  fusion: "#8a63b0",
  synchro: "#c9c9c9",
  xyz: "#4a4a55",
  link: "#1d6ea8",
  spell: "#1d9e74",
  trap: "#bc5a84",
};
