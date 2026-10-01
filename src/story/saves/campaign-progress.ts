import {
  progressSatisfied,
  type CampaignProgress,
  type FactValue,
} from "../../modules/index.ts";
import type { ChapterModule } from "../../modules/index.ts";
import type { StoryState } from "../model/story-state.ts";
import type { StoryBinding } from "./generation-contracts.ts";

export function campaignProgress(binding: StoryBinding): CampaignProgress {
  return {
    schemaVersion: 1,
    completedChapterIds: binding.completedChapterIds,
    facts: binding.facts ?? {},
  };
}
/** Record outcomes without dropping facts belonging to an absent or newer module. */
export function recordCampaignProgress(
  binding: StoryBinding,
  state: StoryState,
  module: ChapterModule,
  beatId?: string,
): StoryBinding {
  const facts: Record<string, FactValue> = { ...binding.facts };
  const prefix = `${binding.chapterId}:`;
  if (state.choice !== null) facts[`${prefix}choice`] = state.choice;
  if (state.encounterId !== null && state.outcome !== null)
    facts[`${prefix}duel:${state.encounterId}:result`] = state.outcome;
  for (const location of state.locations)
    if (location.completed)
      facts[`${prefix}location:${location.id}:completed`] = true;
  if (state.screen === "end") facts[`${prefix}finished`] = true;
  const completed = [...binding.completedChapterIds];
  if (
    module.completion.length > 0 &&
    progressSatisfied(
      { schemaVersion: 1, completedChapterIds: completed, facts },
      module.completion,
    ) &&
    !completed.includes(binding.chapterId)
  )
    completed.push(binding.chapterId);
  return {
    ...binding,
    completedChapterIds: completed,
    facts,
    factsSchemaVersion: 1,
    ...(beatId === undefined ? {} : { beatId }),
  };
}
