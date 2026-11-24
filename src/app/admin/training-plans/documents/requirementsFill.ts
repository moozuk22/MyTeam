/**
 * Decides how a picked exercise fills the section requirements.
 * `ask` means the section already has other text, so the coach confirms the replacement first.
 */
export function requirementsFill(current: string, requirements: string): "skip" | "fill" | "ask" {
  const text = requirements.trim();
  if (!text || current.trim() === text) return "skip";
  return current.trim() ? "ask" : "fill";
}
