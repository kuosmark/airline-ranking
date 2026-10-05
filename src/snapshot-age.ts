export function formatSnapshotAge(updatedAt: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(updatedAt)) / 60_000));
  if (minutes === 0) { return 'just now'; }
  if (minutes < 60) { return `${minutes} min ago`; }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) { return `${hours} hr ago`; }
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}
