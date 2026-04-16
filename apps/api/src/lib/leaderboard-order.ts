export const FEATURED_LEADERBOARD_MODEL_PRIORITY = [
  "anthropic-claude-sonnet-4.6",
  "anthropic-claude-opus-4.6",
  "openai-gpt-5.4",
  "google-gemini-3.1",
] as const;

export function orderLeaderboardModels<T extends { key: string }>(models: T[]) {
  const modelLookup = new Map(models.map((model) => [model.key, model]));
  const prioritizedKeys = new Set<string>(FEATURED_LEADERBOARD_MODEL_PRIORITY);

  const prioritized = FEATURED_LEADERBOARD_MODEL_PRIORITY
    .map((modelKey) => modelLookup.get(modelKey))
    .filter((model): model is T => model !== undefined);
  const fallback = models.filter((model) => !prioritizedKeys.has(model.key));

  return [...prioritized, ...fallback];
}
