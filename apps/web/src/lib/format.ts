export function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function upperSnake(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
}

export function relativeSeconds(value?: string | Date | null) {
  if (!value) return "never";
  const time = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.max(0, Math.round((Date.now() - time.valueOf()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

