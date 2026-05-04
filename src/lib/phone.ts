const PHONE_ALLOWED_CHARACTERS = /^\+?[0-9\s()-]+$/;

export function normalizePhone(value: unknown): string {
  return String(value ?? "").trim();
}

export function isValidPhone(value: string): boolean {
  const normalized = normalizePhone(value);
  if (!normalized || !PHONE_ALLOWED_CHARACTERS.test(normalized)) {
    return false;
  }

  const digitCount = normalized.replace(/\D/g, "").length;
  return digitCount >= 7 && digitCount <= 20;
}
