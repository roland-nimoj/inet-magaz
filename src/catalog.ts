import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';

export interface Product {
  sku: string;
  category: string;
  name: string;
  wholesale_price_rub: string;
  price_100_plus_rub: string;
  price_500_plus_rub: string;
  price_1000_plus_rub: string;
  price_3000_plus_rub: string;
  package_length_mm: string;
  package_width_mm: string;
  package_height_mm: string;
  weight_g: string;
  assembled_dimensions_cm: string;
  kit_contents: string;
  marketplace_url: string;
  notes: string;
}

const requiredColumns: (keyof Product)[] = [
  'sku',
  'category',
  'name',
  'wholesale_price_rub',
  'price_100_plus_rub',
  'price_500_plus_rub',
  'price_1000_plus_rub',
  'price_3000_plus_rub',
  'package_length_mm',
  'package_width_mm',
  'package_height_mm',
  'weight_g',
  'assembled_dimensions_cm',
  'kit_contents',
  'marketplace_url',
  'notes',
];

function isProduct(row: Record<string, unknown>, line: number): Product {
  const product = {} as Product;
  for (const column of requiredColumns) {
    const value = row[column];
    if (typeof value !== 'string') {
      throw new Error(`Catalog row ${line} is missing column "${column}".`);
    }
    product[column] = value.trim();
  }

  if (!product.sku || !product.name || !product.category) {
    throw new Error(`Catalog row ${line} has an empty SKU, name, or category.`);
  }
  for (const column of [
    'wholesale_price_rub',
    'price_100_plus_rub',
    'price_500_plus_rub',
    'price_1000_plus_rub',
    'price_3000_plus_rub',
  ] as const) {
    if (!/^\d+(?:\.\d{1,2})?$/.test(product[column])) {
      throw new Error(`Catalog row ${line} has an invalid value in "${column}".`);
    }
  }
  if (product.marketplace_url && !/^https:\/\//i.test(product.marketplace_url)) {
    throw new Error(`Catalog row ${line} has a non-HTTPS marketplace URL.`);
  }
  return product;
}

export function parseCatalog(csvText: string): Product[] {
  const records = parse(csvText.replace(/^\uFEFF/, ''), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: false,
    trim: true,
  }) as Record<string, unknown>[];

  const products = records.map((row, index) => isProduct(row, index + 2));
  if (products.length === 0) {
    throw new Error('The product catalog is empty.');
  }
  if (new Set(products.map((product) => product.sku)).size !== products.length) {
    throw new Error('The product catalog contains duplicate SKUs.');
  }
  return products;
}

export async function loadCatalog(path: string): Promise<Product[]> {
  return parseCatalog(await readFile(path, 'utf8'));
}
