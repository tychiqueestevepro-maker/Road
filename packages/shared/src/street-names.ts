const replacements: Array<[RegExp, string]> = [
  [/\bstreet\b/gi, "st"],
  [/\bavenue\b/gi, "ave"],
  [/\bboulevard\b/gi, "blvd"],
  [/\broad\b/gi, "rd"],
  [/\bdrive\b/gi, "dr"],
  [/\blane\b/gi, "ln"],
  [/\bhighway\b/gi, "hwy"],
  [/\bnorthbound\b/gi, "nb"],
  [/\bsouthbound\b/gi, "sb"],
  [/\beastbound\b/gi, "eb"],
  [/\bwestbound\b/gi, "wb"]
];

export function normalizeStreetName(input?: string | null): string | undefined {
  if (!input) return undefined;

  let value = input
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  for (const [pattern, replacement] of replacements) {
    value = value.replace(pattern, replacement);
  }

  return value.replace(/\s+/g, " ").trim() || undefined;
}

export function streetNamesProbablyMatch(
  left?: string | null,
  right?: string | null
): boolean {
  const normalizedLeft = normalizeStreetName(left);
  const normalizedRight = normalizeStreetName(right);
  if (!normalizedLeft || !normalizedRight) return false;

  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
}

