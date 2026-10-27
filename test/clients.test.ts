import assert from 'node:assert/strict';
import test from 'node:test';
import type { sheets_v4 } from 'googleapis';
import { ClientStore, type ClientRecord } from '../src/clients.js';

const header = [
  'vk_user_id',
  'last_name',
  'first_name',
  'phone',
  'inn',
  'consent_text_version',
  'consented_at',
  'status',
];

const approvedRow = [
  '42',
  'Иванов',
  'Иван',
  '+79991234567',
  '7707083893',
  '2026-01',
  '2026-01-02T03:04:05.000Z',
  'approved',
];

function record(overrides: Partial<ClientRecord> = {}): ClientRecord {
  return {
    vkUserId: 42,
    lastName: 'Иванов',
    firstName: 'Иван',
    phone: '+79991234567',
    inn: '7707083893',
    consentVersion: '2026-01',
    consentedAt: '2026-01-02T03:04:05.000Z',
    status: 'approved',
    ...overrides,
  };
}

interface FakeSheets {
  sheets: sheets_v4.Sheets;
  rows: string[][];
  calls: { append: number; update: number; clear: string[] };
}

function createFakeSheets(initialRows: string[][]): FakeSheets {
  const rows = initialRows.map((row) => [...row]);
  const calls = { append: 0, update: 0, clear: [] as string[] };

  const values = {
    get: async () => ({ data: { values: rows.map((row) => [...row]) } }),
    append: async ({ requestBody }: { requestBody?: { values?: string[][] } }) => {
      calls.append += 1;
      rows.push(...(requestBody?.values ?? []).map((row) => [...row]));
      return {};
    },
    update: async ({
      range,
      requestBody,
    }: {
      range: string;
      requestBody?: { values?: string[][] };
    }) => {
      calls.update += 1;
      const rowNumber = Number(range.match(/A(\d+)/)?.[1]);
      const nextRow = requestBody?.values?.[0];
      if (rowNumber >= 1 && nextRow) rows[rowNumber - 1] = [...nextRow];
      return {};
    },
    clear: async ({ range }: { range: string }) => {
      calls.clear.push(range);
      const rowNumber = Number(range.match(/A(\d+)/)?.[1]);
      if (rowNumber >= 1) rows[rowNumber - 1] = [];
      return {};
    },
  };

  return {
    sheets: { spreadsheets: { values } } as unknown as sheets_v4.Sheets,
    rows,
    calls,
  };
}

function createStore(fake: FakeSheets) {
  return new ClientStore('spreadsheet-id', 'Clients', '', fake.sheets);
}

test('grants wholesale access only for an approved record', async () => {
  const fake = createFakeSheets([header]);
  const store = createStore(fake);
  assert.equal(await store.hasWholesaleAccess(42), false);

  fake.rows.push([...approvedRow.slice(0, 7), 'pending']);
  assert.equal(await store.hasWholesaleAccess(42), false);

  fake.rows[1] = [...approvedRow];
  assert.equal(await store.hasWholesaleAccess(42), true);
  assert.equal(await store.hasWholesaleAccess(7), false);
});

test('writes an approved application to Google Sheets and then grants access', async () => {
  const fake = createFakeSheets([header]);
  const store = createStore(fake);

  await store.saveApprovedClient(record());

  assert.equal(fake.calls.append, 1);
  assert.equal(fake.calls.update, 0);
  assert.deepEqual(fake.rows[1], approvedRow);
  assert.equal(await store.hasWholesaleAccess(42), true);
});

test('updates an existing client row instead of adding a duplicate', async () => {
  const fake = createFakeSheets([header, [...approvedRow.slice(0, 7), 'pending']]);
  const store = createStore(fake);

  await store.saveApprovedClient(record());

  assert.equal(fake.calls.append, 0);
  assert.equal(fake.calls.update, 1);
  assert.equal(fake.rows.length, 2);
  assert.equal(fake.rows[1][7], 'approved');
});

test('deletes the client row and revokes wholesale access', async () => {
  const fake = createFakeSheets([header, [...approvedRow]]);
  const store = createStore(fake);

  assert.equal(await store.deleteClient(42), true);
  assert.deepEqual(fake.calls.clear, ["'Clients'!A2:H2"]);
  assert.equal(await store.hasWholesaleAccess(42), false);
  assert.equal(await store.deleteClient(42), false);
});

test('rejects a sheet with an unexpected header', async () => {
  const fake = createFakeSheets([['wrong']]);
  const store = createStore(fake);

  await assert.rejects(store.hasWholesaleAccess(42), /8-column header/);
});

test('propagates Google Sheets read and write failures', async () => {
  const readFailure = {
    spreadsheets: {
      values: {
        get: async () => {
          throw new Error('Google API unavailable');
        },
      },
    },
  } as unknown as sheets_v4.Sheets;
  const readStore = new ClientStore('spreadsheet-id', 'Clients', '', readFailure);

  await assert.rejects(readStore.hasWholesaleAccess(42), /Google API unavailable/);
  await assert.rejects(readStore.saveApprovedClient(record()), /Google API unavailable/);

  const writeFailure = {
    spreadsheets: {
      values: {
        get: async () => ({ data: { values: [header] } }),
        append: async () => {
          throw new Error('Append failed');
        },
      },
    },
  } as unknown as sheets_v4.Sheets;
  const writeStore = new ClientStore('spreadsheet-id', 'Clients', '', writeFailure);

  await assert.rejects(writeStore.saveApprovedClient(record()), /Append failed/);
});
