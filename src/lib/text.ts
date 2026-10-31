export function textCounts(value: string): string {
  const characters = [...value].length;
  const words = value.trim().split(/\s+/).filter(Boolean).length;
  return `${characters} ${characters === 1 ? "character" : "characters"} · ${words} ${words === 1 ? "word" : "words"}`;
}
