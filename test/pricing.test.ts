import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRubles, retailPriceRub } from '../src/pricing.js';

test('retail price is rounded upward to the next ten rubles', () => {
  assert.equal(retailPriceRub('450.00'), 1130);
  assert.equal(retailPriceRub('400.00'), 1000);
  assert.equal(retailPriceRub('1.00'), 10);
  assert.equal(retailPriceRub('0.00'), 0);
});

test('retail calculation supports fractional wholesale prices exactly', () => {
  assert.equal(retailPriceRub('100.01'), 260);
});

test('invalid wholesale price is rejected', () => {
  assert.throws(() => retailPriceRub('1.001'));
  assert.throws(() => retailPriceRub('-1'));
});

test('rubles are formatted in Russian locale', () => {
  assert.equal(formatRubles(1130), '1 130 ₽');
});
