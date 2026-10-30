// The editor's save status, as in the canvas: "Saved · just now".

export function savedLabel(savedAt: Date, now: Date): string {
  const seconds = Math.max(0, Math.round((now.getTime() - savedAt.getTime()) / 1000));
  if (seconds < 45) return "Saved · just now";
  const minutes = Math.max(1, Math.floor(seconds / 60));
  if (minutes < 60) return `Saved · ${minutes} min ago`;
  return `Saved · ${Math.floor(minutes / 60)} h ago`;
}
