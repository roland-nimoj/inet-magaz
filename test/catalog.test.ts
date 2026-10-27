import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseCatalog } from '../src/catalog.js';
import { productCard } from '../src/presentation.js';

test('loads the provided product catalog', async () => {
  const csv = await readFile(new URL('../catalog.csv', import.meta.url), 'utf8');
  const products = parseCatalog(csv);
  assert.equal(products.length, 36);
  assert.equal(products[0].sku, 'КК151520С1');
  assert.equal(products[0].wholesale_price_rub, '450.00');

  const quotedName = products.find((product) => product.sku === 'КФ131611Д');
  assert.equal(quotedName?.name, 'Ящик 13 × 16 см — размер S, тип 1');
  assert.equal(quotedName?.notes, '');
});

test('does not invent a marketplace URL for products without one', async () => {
  const csv = await readFile(new URL('../catalog.csv', import.meta.url), 'utf8');
  const products = parseCatalog(csv);
  const withoutLink = products.filter((product) => product.marketplace_url === '');
  assert.equal(withoutLink.length, 1);
  assert.equal(withoutLink[0].sku, 'КК101216БО');

  const card = productCard(withoutLink[0]);
  assert.match(card, /КК101216БО/);
  assert.match(card, /Комплект:/);
  assert.doesNotMatch(card, /Ссылка:/);
});

test('rejects malformed and duplicate catalog rows', () => {
  const header = 'sku,category,name,wholesale_price_rub,price_100_plus_rub,price_500_plus_rub,price_1000_plus_rub,price_3000_plus_rub,package_length_mm,package_width_mm,package_height_mm,weight_g,assembled_dimensions_cm,kit_contents,marketplace_url,notes';
  const row = 'SKU,Cat,Name,1.00,1.00,1.00,1.00,1.00,1,1,1,1,1 cm,parts,,';
  assert.equal(parseCatalog(`${header}\n${row}`).length, 1);
  assert.throws(() => parseCatalog(`${header}\n${row}\n${row}`), /duplicate SKUs/i);
  assert.throws(() => parseCatalog(`${header}\n${row.replace('1.00', 'bad')}`), /invalid value/i);
});

test('public product card contains retail price only', async () => {
  const csv = await readFile(new URL('../catalog.csv', import.meta.url), 'utf8');
  const product = parseCatalog(csv)[0];
  const card = productCard(product);
  assert.match(card, /Цена: 1 130 ₽/);
  assert.doesNotMatch(card, /Оптовая цена|От 100 шт\./);
});

test('wholesale product card shows the wholesale tiers', async () => {
  const csv = await readFile(new URL('../catalog.csv', import.meta.url), 'utf8');
  const product = parseCatalog(csv)[0];
  const card = productCard(product, true);
  assert.match(card, /Оптовая цена: 450 ₽/);
  assert.match(card, /От 100 шт\.: 445 ₽/);
});
