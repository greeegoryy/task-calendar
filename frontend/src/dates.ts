export function toLocal(date: Date): string {
  const adjusted = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return adjusted.toISOString().slice(0, 16);
}

export function localValue(iso: string): string {
  return toLocal(new Date(iso));
}
