import type { Product } from './catalog.js';

export const PRODUCTS_PER_PAGE = 8;
export const VISIBLE_CATEGORIES = 8;

export function listCategories(products: Product[]): string[] {
  return [...new Set(products.map((product) => product.category))];
}

export function productsInCategory(products: Product[], category: string): Product[] {
  return products.filter((product) => product.category === category);
}

export function pageItems<T>(items: T[], page: number, pageSize = PRODUCTS_PER_PAGE): T[] {
  return items.slice(page * pageSize, (page + 1) * pageSize);
}

export function hasNextPage(totalItems: number, page: number, pageSize = PRODUCTS_PER_PAGE): boolean {
  return (page + 1) * pageSize < totalItems;
}

export function pageCount(totalItems: number, pageSize = PRODUCTS_PER_PAGE): number {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}
