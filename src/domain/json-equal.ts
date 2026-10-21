// JSON object member order is not meaningful; ordered arrays remain significant.
export function jsonEqual(left: unknown, right: unknown): boolean {
  const normalize = (_key: string, value: unknown) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
        )
      : value;
  return JSON.stringify(left, normalize) === JSON.stringify(right, normalize);
}
