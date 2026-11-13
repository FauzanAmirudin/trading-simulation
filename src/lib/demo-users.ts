export const DEMO_USERNAMES = ["andi", "budi", "citra", "doni"] as const;

export function isDemoUsername(name?: string | null): boolean {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  return DEMO_USERNAMES.includes(normalized as typeof DEMO_USERNAMES[number]);
}

export function filterOutDemoUsers<T extends { nama?: string | null }>(items: T[]): T[] {
  return items.filter((item) => !isDemoUsername(item.nama));
}
