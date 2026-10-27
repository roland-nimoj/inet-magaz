import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseCatalog } from '../src/catalog.js';
import {
  hasNextPage,
  listCategories,
  pageCount,
  pageItems,
  productsInCategory,
  PRODUCTS_PER_PAGE,
} from '../src/navigation.js';

async function loadProducts() {
  const csv = await readFile(new URL('../catalog.csv', import.meta.url), 'utf8');
  return parseCatalog(csv);
}

test('lists categories in catalog order', async () => {
  const products = await loadProducts();
  assert.deepEqual(listCategories(products), ['Конструкторы', 'Упаковка']);
});

test('filters products by category and paginates long lists', async () => {
  const products = await loadProducts();
  const constructors = productsInCategory(products, 'Конструкторы');

  assert.equal(constructors.length, 22);
  assert.equal(pageCount(constructors.length), 3);
  assert.equal(pageItems(constructors, 0).length, PRODUCTS_PER_PAGE);
  assert.equal(pageItems(constructors, 2).length, 6);
  assert.equal(pageItems(constructors, 3).length, 0);
  assert.equal(hasNextPage(constructors.length, 0), true);
  assert.equal(hasNextPage(constructors.length, 1), true);
  assert.equal(hasNextPage(constructors.length, 2), false);
});

test('returns no products for an unknown or empty category', async () => {
  const products = await loadProducts();
  assert.deepEqual(productsInCategory(products, 'Неизвестная категория'), []);
});
