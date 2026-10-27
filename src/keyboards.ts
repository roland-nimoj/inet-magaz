import { Keyboard } from 'vk-io';
import type { Product } from './catalog.js';
import { PRODUCTS_PER_PAGE, VISIBLE_CATEGORIES } from './navigation.js';

type ButtonColor = 'primary' | 'positive' | 'negative' | 'secondary';

const MAX_LABEL_LENGTH = 40;
const BUTTONS_PER_ROW = 2;

function truncateLabel(value: string): string {
  if (value.length <= MAX_LABEL_LENGTH) return value;
  return `${value.slice(0, MAX_LABEL_LENGTH - 1)}…`;
}

function button(label: string, command: string, color: ButtonColor = 'primary') {
  return {
    label: truncateLabel(label),
    payload: { command },
    color,
  };
}

export function mainKeyboard() {
  return Keyboard.builder()
    .textButton(button('Каталог', 'catalog'))
    .textButton(button('Оптовые цены', 'register', 'positive'))
    .row()
    .textButton(button('Удалить мои данные', 'privacy:delete', 'negative'))
    .oneTime();
}

export function consentKeyboard() {
  return Keyboard.builder()
    .textButton(button('Согласен', 'consent:yes', 'positive'))
    .textButton(button('Отказываюсь', 'consent:no', 'negative'))
    .oneTime();
}

export function deleteDataKeyboard() {
  return Keyboard.builder()
    .textButton(button('Да, удалить', 'privacy:confirm', 'negative'))
    .textButton(button('Отмена', 'menu'))
    .oneTime();
}

export function categoriesKeyboard(categories: string[], page = 0) {
  const keyboard = Keyboard.builder();
  const items = categories.slice(
    page * VISIBLE_CATEGORIES,
    (page + 1) * VISIBLE_CATEGORIES,
  );
  items.forEach((category, index) => {
    if (index > 0 && index % BUTTONS_PER_ROW === 0) keyboard.row();
    keyboard.textButton(button(category, `category:${category}`));
  });

  const hasBack = page > 0;
  const hasNext = (page + 1) * VISIBLE_CATEGORIES < categories.length;
  if (hasBack || hasNext) {
    keyboard.row();
    if (hasBack) keyboard.textButton(button('← Назад', `categories:${page - 1}`));
    if (hasNext) keyboard.textButton(button('Далее →', `categories:${page + 1}`));
  }

  keyboard.row().textButton(button('В меню', 'menu'));
  return keyboard;
}

export function productsKeyboard(
  category: string,
  page: number,
  pageItems: Product[],
  totalItems: number,
) {
  const keyboard = Keyboard.builder();
  pageItems.forEach((product, index) => {
    if (index > 0 && index % BUTTONS_PER_ROW === 0) keyboard.row();
    const number = page * PRODUCTS_PER_PAGE + index + 1;
    keyboard.textButton(button(`${number}. ${product.name}`, `product:${product.sku}`));
  });

  const hasBack = page > 0;
  const hasNext = (page + 1) * PRODUCTS_PER_PAGE < totalItems;
  if (hasBack || hasNext) {
    keyboard.row();
    if (hasBack) keyboard.textButton(button('← Назад', `page:${category}:${page - 1}`));
    if (hasNext) keyboard.textButton(button('Далее →', `page:${category}:${page + 1}`));
  }

  return keyboard
    .row()
    .textButton(button('Категории', 'catalog'))
    .textButton(button('В меню', 'menu'))
    .oneTime();
}

export function productKeyboard(back?: { category: string; page: number }) {
  const keyboard = Keyboard.builder();
  if (back) {
    keyboard
      .textButton(button('← Назад к списку', `page:${back.category}:${back.page}`))
      .row();
  }
  return keyboard
    .textButton(button('Категории', 'catalog'))
    .textButton(button('В меню', 'menu'))
    .oneTime();
}
