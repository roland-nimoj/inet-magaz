export function retailPriceRub(wholesalePriceRub: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(wholesalePriceRub)) {
    throw new Error('Wholesale price must be a non-negative amount with up to two decimals.');
  }

  const [rubles, fractional = ''] = wholesalePriceRub.split('.');
  const kopecks = Number(rubles) * 100 + Number(fractional.padEnd(2, '0'));
  return Math.ceil((kopecks * 5) / 2000) * 10;
}

export function formatRubles(amount: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(amount)} ₽`;
}
