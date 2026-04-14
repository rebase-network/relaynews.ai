export function toIso(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return value.toISOString();
}

export function subtractHours(base: Date, hours: number) {
  return new Date(base.getTime() - hours * 60 * 60 * 1000);
}

export function subtractDays(base: Date, days: number) {
  return new Date(base.getTime() - days * 24 * 60 * 60 * 1000);
}
