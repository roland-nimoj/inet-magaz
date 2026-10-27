import type { Product } from './catalog.js';
import { formatRubles, retailPriceRub } from './pricing.js';

export function productCard(product: Product, wholesalePrice = false): string {
  const lines = [
    product.name,
    `Артикул: ${product.sku}`,
    `Размер в сборке: ${product.assembled_dimensions_cm}`,
    `Размер упаковки: ${product.package_length_mm} × ${product.package_width_mm} × ${product.package_height_mm} мм`,
    `Вес: ${product.weight_g} г`,
    `Комплект: ${product.kit_contents}`,
  ];
  if (wholesalePrice) {
    lines.push(
      `Оптовая цена: ${formatRubles(Number(product.wholesale_price_rub))}`,
      `От 100 шт.: ${formatRubles(Number(product.price_100_plus_rub))}`,
      `От 500 шт.: ${formatRubles(Number(product.price_500_plus_rub))}`,
      `От 1000 шт.: ${formatRubles(Number(product.price_1000_plus_rub))}`,
      `От 3000 шт.: ${formatRubles(Number(product.price_3000_plus_rub))}`,
    );
  } else {
    lines.push(`Цена: ${formatRubles(retailPriceRub(product.wholesale_price_rub))}`);
  }
  if (product.marketplace_url) lines.push(`Ссылка: ${product.marketplace_url}`);
  if (product.notes) lines.push(`Примечание: ${product.notes}`);
  return lines.join('\n');
}
