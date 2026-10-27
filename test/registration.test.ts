import assert from 'node:assert/strict';
import test from 'node:test';
import { RegistrationFlow } from '../src/registration.js';

const settings = {
  consentText: 'Утверждённый владельцем текст согласия на обработку персональных данных.',
  consentVersion: '2026-01',
  now: () => new Date('2026-01-02T03:04:05.000Z'),
};

function reachConsent() {
  const flow = new RegistrationFlow(42, settings);
  assert.equal(flow.submit('Иванов').type, 'next');
  assert.equal(flow.submit('Иван').type, 'next');
  assert.equal(flow.submit('+7 999 123-45-67').type, 'next');
  const result = flow.submit('7707083893');
  assert.equal(result.type, 'next');
  assert.equal(flow.currentStep, 'consent');
  return flow;
}

test('collects all required fields and creates a record only after consent', () => {
  const flow = reachConsent();

  const withoutConsent = flow.submit('ещё не решил');
  assert.equal(withoutConsent.type, 'next');
  if (withoutConsent.type === 'next') {
    assert.equal(withoutConsent.step, 'consent');
    assert.equal(withoutConsent.showConsentKeyboard, true);
    assert.equal(withoutConsent.message, settings.consentText);
  }

  const completed = flow.submit('Согласен');
  assert.equal(completed.type, 'completed');
  if (completed.type === 'completed') {
    assert.deepEqual(completed.record, {
      vkUserId: 42,
      lastName: 'Иванов',
      firstName: 'Иван',
      phone: '+7 999 123-45-67',
      inn: '7707083893',
      consentVersion: '2026-01',
      consentedAt: '2026-01-02T03:04:05.000Z',
      status: 'approved',
    });
  }
});

test('does not advance past invalid required fields', () => {
  const flow = new RegistrationFlow(42, settings);

  assert.equal(flow.submit('').type, 'invalid');
  assert.equal(flow.currentStep, 'lastName');

  assert.equal(flow.submit('Иванов').type, 'next');
  assert.equal(flow.submit('И').type, 'invalid');
  assert.equal(flow.currentStep, 'firstName');

  assert.equal(flow.submit('Иван').type, 'next');
  assert.equal(flow.submit('123').type, 'invalid');
  assert.equal(flow.currentStep, 'phone');

  assert.equal(flow.submit('+79991234567').type, 'next');
  assert.equal(flow.submit('123456789').type, 'invalid');
  assert.equal(flow.currentStep, 'inn');

  const consent = flow.submit('7707083893');
  assert.equal(consent.type, 'next');
  assert.equal(flow.currentStep, 'consent');
});

test('shows the configured consent text before confirmation', () => {
  const flow = new RegistrationFlow(42, settings);
  flow.submit('Иванов');
  flow.submit('Иван');
  flow.submit('+79991234567');

  const result = flow.submit('7707083893');
  assert.equal(result.type, 'next');
  if (result.type === 'next') {
    assert.equal(result.message, settings.consentText);
    assert.equal(result.showConsentKeyboard, true);
  }
});

test('declining consent ends registration without creating a client', () => {
  const flow = reachConsent();
  const declined = flow.submit('Отказываюсь');

  assert.equal(declined.type, 'declined');
  assert.equal(flow.submit('Согласен').type, 'invalid');
});
