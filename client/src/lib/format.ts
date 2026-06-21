export function money(value: number | string | null | undefined, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function pct(value: number | string | null | undefined) {
  return `${Math.round(Number(value || 0))}%`;
}

export function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export function monthInput() {
  return new Date().toISOString().slice(0, 7);
}
