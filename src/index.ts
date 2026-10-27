import { VK } from 'vk-io';
import { ClientStore } from './clients.js';
import { loadCatalog, type Product } from './catalog.js';
import { config } from './config.js';
import {
  categoriesKeyboard,
  consentKeyboard,
  deleteDataKeyboard,
  mainKeyboard,
  productKeyboard,
  productsKeyboard,
} from './keyboards.js';
import {
  listCategories,
  pageCount,
  pageItems,
  productsInCategory,
  PRODUCTS_PER_PAGE,
  VISIBLE_CATEGORIES,
} from './navigation.js';
import { productCard } from './presentation.js';
import { RegistrationFlow, registrationPrompts } from './registration.js';

type Flow =
  | { type: 'category' }
  | { type: 'products'; category: string; page: number }
  | { type: 'registration'; registration: RegistrationFlow };

interface MessageContext {
  send(message: string, options?: object): Promise<unknown>;
  text?: string;
}

const vk = new VK({
  token: config.vkToken,
  ...(config.vkGroupId ? { pollingGroupId: config.vkGroupId } : {}),
});
const clients = new ClientStore(
  config.googleSpreadsheetId,
  config.googleSheetName,
  config.googleServiceAccountJson,
);
const flows = new Map<number, Flow>();
const processedEvents = new Set<string>();
const MAX_TRACKED_EVENTS = 1000;
let products: Product[] = [];

function isDuplicateEvent(eventKey: string): boolean {
  if (processedEvents.has(eventKey)) return true;
  processedEvents.add(eventKey);
  if (processedEvents.size > MAX_TRACKED_EVENTS) {
    const oldest = processedEvents.values().next().value;
    if (oldest !== undefined) processedEvents.delete(oldest);
  }
  return false;
}

async function showCategories(
  context: MessageContext,
  userId: number,
  page = 0,
  title = 'Выберите категорию',
) {
  const categories = listCategories(products);
  const totalPages = pageCount(categories.length, VISIBLE_CATEGORIES);
  if (page < 0 || page >= totalPages) {
    await context.send('Страница категорий не найдена. Откройте каталог заново.', {
      keyboard: mainKeyboard(),
    });
    return;
  }

  flows.set(userId, { type: 'category' });
  const heading = totalPages > 1
    ? `${title} (страница ${page + 1} из ${totalPages}):`
    : `${title}:`;
  await context.send(heading, { keyboard: categoriesKeyboard(categories, page) });
}

async function showProducts(
  context: MessageContext,
  userId: number,
  category: string,
  page: number,
) {
  const matching = productsInCategory(products, category);
  if (matching.length === 0) {
    await showCategories(context, userId, 0, 'Категория не найдена. Выберите категорию заново');
    return;
  }

  const items = pageItems(matching, page);
  if (items.length === 0) {
    await showCategories(context, userId, 0, 'На этой странице нет товаров. Выберите категорию');
    return;
  }

  flows.set(userId, { type: 'products', category, page });
  const lines = items.map(
    (item, index) => `${page * PRODUCTS_PER_PAGE + index + 1}. ${item.name}`,
  );
  await context.send(
    `${category} — страница ${page + 1} из ${pageCount(matching.length)}\n${lines.join('\n')}\n\nВыберите товар кнопкой или отправьте артикул.`,
    { keyboard: productsKeyboard(category, page, items, matching.length) },
  );
}

async function startRegistration(context: MessageContext, userId: number) {
  flows.set(userId, {
    type: 'registration',
    registration: new RegistrationFlow(userId, {
      consentText: config.consentText,
      consentVersion: config.consentVersion,
    }),
  });
  await context.send(registrationPrompts.lastName);
}

async function handleRegistration(
  context: MessageContext,
  userId: number,
  registration: RegistrationFlow,
  textOverride?: string,
) {
  const result = registration.submit(textOverride ?? context.text ?? '');

  if (result.type === 'invalid') {
    await context.send(result.message);
    return;
  }

  if (result.type === 'declined') {
    flows.delete(userId);
    await context.send(result.message, { keyboard: mainKeyboard() });
    return;
  }

  if (result.type === 'completed') {
    try {
      await clients.saveApprovedClient(result.record);
    } catch (error) {
      console.error(
        'Google Sheets write failed:',
        error instanceof Error ? error.name : 'Unknown error',
      );
      flows.delete(userId);
      await context.send(
        'Не удалось сохранить заявку. Доступ не изменён; попробуйте позже или свяжитесь с магазином.',
      );
      return;
    }
    flows.delete(userId);
    await context.send(
      'Данные сохранены в защищённой таблице. Оптовые цены доступны. Выберите товар из каталога.',
      { keyboard: mainKeyboard() },
    );
    return;
  }

  await context.send(
    result.message,
    result.showConsentKeyboard ? { keyboard: consentKeyboard() } : undefined,
  );
}

async function sendProductCard(
  context: MessageContext,
  userId: number,
  product: Product,
  back?: { category: string; page: number },
) {
  let hasWholesaleAccess = false;
  let accessCheckFailed = false;
  try {
    hasWholesaleAccess = await clients.hasWholesaleAccess(userId);
  } catch (error) {
    console.error(
      'Google Sheets access check failed:',
      error instanceof Error ? error.name : 'Unknown error',
    );
    accessCheckFailed = true;
  }

  const card = productCard(product, hasWholesaleAccess);
  const message = accessCheckFailed
    ? `${card}\n\nОптовый доступ временно не проверен; показана розничная цена.`
    : card;
  await context.send(message, { keyboard: productKeyboard(back) });
}

vk.updates.on('message_new', async (context) => {
  if (isDuplicateEvent(`${context.peerId}:${context.id}`)) return;

  const userId = context.senderId;
  const text = (context.text ?? '').trim();
  const payload = context.messagePayload as { command?: string } | undefined;
  const command = payload?.command ?? text.toLowerCase();

  if (context.isChat) {
    await context.send(
      'Каталог и оформление оптового доступа доступны только в личных сообщениях сообщества.',
    );
    return;
  }

  if (!userId || userId < 0) {
    await context.send('Откройте личные сообщения сообщества, чтобы пользоваться каталогом.');
    return;
  }
  try {
    if (command === 'menu' || command === 'начать' || command === 'start') {
      flows.delete(userId);
      await context.send(
        'Здравствуйте! Здесь можно посмотреть каталог или запросить оптовые цены.',
        { keyboard: mainKeyboard() },
      );
      return;
    }
    if (command === 'catalog' || command === 'каталог') {
      await showCategories(context, userId);
      return;
    }
    if (command === 'register' || command === 'оптовые цены') {
      if (await clients.hasWholesaleAccess(userId)) {
        await context.send('Оптовый доступ уже активен. Выберите товар из каталога.', {
          keyboard: mainKeyboard(),
        });
      } else {
        await startRegistration(context, userId);
      }
      return;
    }
    if (command === 'privacy:delete' || command === 'удалить мои данные') {
      await context.send(
        'Удалить ваши персональные данные из таблицы и отключить оптовый доступ?',
        { keyboard: deleteDataKeyboard() },
      );
      return;
    }
    if (command === 'privacy:confirm') {
      const deleted = await clients.deleteClient(userId);
      flows.delete(userId);
      await context.send(
        deleted
          ? 'Данные удалены из таблицы, оптовый доступ отключён.'
          : 'В таблице нет сохранённых данных; оптовый доступ не активен.',
        { keyboard: mainKeyboard() },
      );
      return;
    }
    if (command === 'consent:yes') {
      const flow = flows.get(userId);
      if (flow?.type === 'registration') {
        await handleRegistration(context, userId, flow.registration, 'Согласен');
      } else {
        await context.send('Заявка не найдена. Нажмите «Оптовые цены», чтобы начать.', {
          keyboard: mainKeyboard(),
        });
      }
      return;
    }
    if (command === 'consent:no') {
      const flow = flows.get(userId);
      if (flow?.type === 'registration') {
        await handleRegistration(context, userId, flow.registration, 'Отказываюсь');
      } else {
        await context.send('Заявка не найдена. Нажмите «Оптовые цены», чтобы начать.', {
          keyboard: mainKeyboard(),
        });
      }
      return;
    }
    if (command.startsWith('categories:')) {
      const page = Number(command.slice('categories:'.length));
      if (Number.isInteger(page) && page >= 0) {
        await showCategories(context, userId, page);
      } else {
        await context.send('Страница категорий не найдена. Откройте каталог заново.', {
          keyboard: mainKeyboard(),
        });
      }
      return;
    }
    if (command.startsWith('category:')) {
      const category = command.slice('category:'.length);
      await showProducts(context, userId, category, 0);
      return;
    }
    if (command.startsWith('page:')) {
      const rest = command.slice('page:'.length);
      const separator = rest.lastIndexOf(':');
      const category = separator > 0 ? rest.slice(0, separator) : '';
      const page = separator > 0 ? Number(rest.slice(separator + 1)) : Number.NaN;
      if (
        Number.isInteger(page) &&
        page >= 0 &&
        products.some((product) => product.category === category)
      ) {
        await showProducts(context, userId, category, page);
      } else {
        await context.send('Страница не найдена. Откройте каталог заново.', {
          keyboard: mainKeyboard(),
        });
      }
      return;
    }
    const flow = flows.get(userId);
    if (command.startsWith('product:')) {
      const sku = command.slice('product:'.length);
      const product = products.find((item) => item.sku === sku);
      if (product) {
        const back = flow?.type === 'products'
          ? { category: flow.category, page: flow.page }
          : undefined;
        await sendProductCard(context, userId, product, back);
      } else {
        await context.send('Товар не найден. Откройте каталог, чтобы выбрать товар.', {
          keyboard: mainKeyboard(),
        });
      }
      return;
    }

    if (flow?.type === 'registration') {
      await handleRegistration(context, userId, flow.registration);
      return;
    }

    if (text && products.some((product) => product.sku.toLowerCase() === text.toLowerCase())) {
      const product = products.find(
        (item) => item.sku.toLowerCase() === text.toLowerCase(),
      )!;
      const back = flow?.type === 'products'
        ? { category: flow.category, page: flow.page }
        : undefined;
      await sendProductCard(context, userId, product, back);
      return;
    }

    if (flow?.type === 'category') {
      const category = listCategories(products).find(
        (item) => item.toLowerCase() === text.toLowerCase(),
      );
      if (category) {
        await showProducts(context, userId, category, 0);
        return;
      }
    }

    if (flow?.type === 'products') {
      const match = text.match(/^\d+$/);
      if (match) {
        const categoryItems = productsInCategory(products, flow.category);
        const product = categoryItems[Number(text) - 1];
        if (product) {
          await sendProductCard(context, userId, product, {
            category: flow.category,
            page: flow.page,
          });
          return;
        }
      }
    }

    await context.send('Не распознал команду. Нажмите кнопку ниже, чтобы открыть каталог.', {
      keyboard: mainKeyboard(),
    });
  } catch (error) {
    console.error(
      'Message handling failed:',
      error instanceof Error ? error.name : 'Unknown error',
    );
    await context.send('Не удалось выполнить запрос. Попробуйте позже.');
  }
});

async function main() {
  products = await loadCatalog(config.catalogPath);
  await vk.updates.start();
  console.info(`VK bot started. Loaded ${products.length} products.`);
}

main().catch((error: unknown) => {
  console.error(
    'Bot startup failed:',
    error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown error',
  );
  process.exitCode = 1;
});
