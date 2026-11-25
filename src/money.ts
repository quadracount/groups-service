/** 8000 -> "$8.000", -8000 -> "−$8.000" (pesos chilenos, siempre con signo si es negativo). */
export function formatMoney(amount: number): string {
  const sign = amount < 0 ? '−' : '';
  const digits = Math.abs(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}$${digits}`;
}
