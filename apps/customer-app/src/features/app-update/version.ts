/** Compare dotted numeric versions. Negative when left is older. */
export function compareVersions(left: string, right: string): number {
  const a = left.split('.').map((part) => parseInt(part, 10) || 0);
  const b = right.split('.').map((part) => parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function isOlderThan(installed: string, minimum: string): boolean {
  return compareVersions(installed, minimum) < 0;
}
