export function parsePaymentAmount(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const normalized = String(value).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0 || amount > 99999999.99) {
    return null;
  }

  return amount.toFixed(2);
}

