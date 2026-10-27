import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseCatalog } from '../src/catalog.js';
import {
  categoriesKeyboard,
  consentKeyboard,
  mainKeyboard,
  productKeyboard,
  productsKeyboard,
} from '../src/keyboards.js';
import { productsInCategory } from '../src/navigation.js';

interface KeyboardRow {
  action: { label: string; payload: string };
}

interface KeyboardJson {
  buttons: KeyboardRow[][];
  one_time: boolean;
}

function parseKeyboard(keyboard: { toString(): string }): KeyboardJson {
  return JSON.parse(keyboard.toString()) as KeyboardJson;
}

function assertValidKeyboard(keyboard: { toString(): string }) {
  const parsed = parseKeyboard(keyboard);
  assert.ok(parsed.buttons.length > 0);
  assert.ok(parsed.buttons.length <= 10);
  for (const row of parsed.buttons) {
    assert.ok(row.length > 0);
    assert.ok(row.length <= 5);
    for (const button of row) {
      assert.ok(button.action.label.length <= 40);
      assert.ok(button.action.payload.length <= 255);
    }
  }
  return parsed;
}

test('category keyboard respects VK row and label limits', () => {
  const categories = Array.from({ length: 8 }, (_, index) => `Категория ${index + 1}`);
  categories[0] = 'Очень длинное название категории, которое не влезает в кнопку';
  const parsed = assertValidKeyboard(categoriesKeyboard(categories));

  const commands = parsed.buttons.flat().map((button) => JSON.parse(button.action.payload).command);
  assert.ok(commands.includes('category:Категория 2'));
  assert.ok(commands.includes('menu'));
});

test('long category lists are paginated', () => {
  const categories = Array.from({ length: 10 }, (_, index) => `Категория ${index + 1}`);
  const firstPage = assertValidKeyboard(categoriesKeyboard(categories));
  const firstCommands = firstPage.buttons
    .flat()
    .map((button) => JSON.parse(button.action.payload).command);

  assert.ok(firstCommands.includes('category:Категория 1'));
  assert.ok(!firstCommands.includes('category:Категория 9'));
  assert.ok(firstCommands.includes('categories:1'));

  const secondPage = assertValidKeyboard(categoriesKeyboard(categories, 1));
  const secondCommands = secondPage.buttons
    .flat()
    .map((button) => JSON.parse(button.action.payload).command);

  assert.ok(secondCommands.includes('category:Категория 9'));
  assert.ok(secondCommands.includes('categories:0'));
});

test('products keyboard fits product and navigation buttons into rows', async () => {
  const csv = await readFile(new URL('../catalog.csv', import.meta.url), 'utf8');
  const products = parseCatalog(csv);
  const constructors = productsInCategory(products, 'Конструкторы');
  const page = constructors.slice(0, 8);

  const parsed = assertValidKeyboard(productsKeyboard('Конструкторы', 0, page, constructors.length));
  const commands = parsed.buttons.flat().map((button) => JSON.parse(button.action.payload).command);

  assert.ok(commands.includes('product:КК151520С1'));
  assert.ok(commands.includes('page:Конструкторы:1'));
  assert.ok(commands.includes('catalog'));
  assert.ok(commands.includes('menu'));
  assert.equal(parsed.one_time, true);
});

test('main and consent keyboards stay within platform limits', () => {
  assertValidKeyboard(mainKeyboard());
  assertValidKeyboard(consentKeyboard());
});

test('product keyboard offers a way back to the category list', () => {
  const parsed = assertValidKeyboard(productKeyboard({ category: 'Конструкторы', page: 1 }));
  const commands = parsed.buttons.flat().map((button) => JSON.parse(button.action.payload).command);

  assert.ok(commands.includes('page:Конструкторы:1'));
  assert.ok(commands.includes('catalog'));
  assert.ok(commands.includes('menu'));
});
