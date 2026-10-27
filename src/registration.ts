import type { ClientRecord } from './clients.js';

export type RegistrationStep = 'lastName' | 'firstName' | 'phone' | 'inn' | 'consent';

type ClientFields = Pick<ClientRecord, 'lastName' | 'firstName' | 'phone' | 'inn'>;

export interface RegistrationSettings {
  consentText: string;
  consentVersion: string;
  now?: () => Date;
}

export type RegistrationResult =
  | { type: 'invalid'; message: string }
  | { type: 'next'; step: RegistrationStep; message: string; showConsentKeyboard: boolean }
  | { type: 'declined'; message: string }
  | { type: 'completed'; record: ClientRecord };

export const registrationPrompts: Record<Exclude<RegistrationStep, 'consent'>, string> = {
  lastName: 'Для оптового доступа отправьте вашу фамилию.',
  firstName: 'Теперь отправьте ваше имя.',
  phone: 'Отправьте номер телефона, например +79991234567.',
  inn: 'Отправьте ИНН (10 или 12 цифр).',
};

const validators: Record<Exclude<RegistrationStep, 'consent'>, (value: string) => boolean> = {
  lastName: (value) => /^[\p{L}-]{2,60}$/u.test(value),
  firstName: (value) => /^[\p{L}-]{2,60}$/u.test(value),
  phone: (value) => /^\+?[0-9 ()-]{10,20}$/.test(value),
  inn: (value) => /^\d{10}(?:\d{2})?$/.test(value),
};

const errors: Record<Exclude<RegistrationStep, 'consent'>, string> = {
  lastName: 'Введите фамилию (буквы или дефис).',
  firstName: 'Введите имя (буквы или дефис).',
  phone: 'Проверьте формат телефона и отправьте ещё раз.',
  inn: 'ИНН должен содержать 10 или 12 цифр.',
};

const nextStep: Record<Exclude<RegistrationStep, 'consent'>, RegistrationStep> = {
  lastName: 'firstName',
  firstName: 'phone',
  phone: 'inn',
  inn: 'consent',
};

export class RegistrationFlow {
  private step: RegistrationStep = 'lastName';
  private data: Partial<ClientFields> = {};
  private finished = false;

  constructor(
    private readonly vkUserId: number,
    private readonly settings: RegistrationSettings,
  ) {}

  get currentStep(): RegistrationStep {
    return this.step;
  }

  submit(rawText: string): RegistrationResult {
    if (this.finished) {
      return { type: 'invalid', message: 'Заявка уже отправлена. Откройте каталог.' };
    }

    const text = rawText.trim();
    if (this.step === 'consent') {
      return this.submitConsent(text);
    }

    const field = this.step;
    if (!text || !validators[field](text)) {
      return { type: 'invalid', message: errors[field] };
    }

    this.data[field] = text;
    const step = nextStep[field];
    this.step = step;

    if (step === 'consent') {
      return {
        type: 'next',
        step,
        message: this.settings.consentText,
        showConsentKeyboard: true,
      };
    }

    return {
      type: 'next',
      step,
      message: registrationPrompts[step],
      showConsentKeyboard: false,
    };
  }

  private submitConsent(text: string): RegistrationResult {
    const normalized = text.toLowerCase();

    if (['отказываюсь', 'отказ', 'нет'].includes(normalized)) {
      this.finished = true;
      return {
        type: 'declined',
        message: 'Согласие не предоставлено. Оптовые цены не подключены.',
      };
    }

    if (!['согласен', 'согласие', 'да'].includes(normalized)) {
      return {
        type: 'next',
        step: 'consent',
        message: this.settings.consentText,
        showConsentKeyboard: true,
      };
    }

    const { lastName, firstName, phone, inn } = this.data;
    if (!lastName || !firstName || !phone || !inn) {
      return { type: 'invalid', message: 'Заполните все поля заявки заново.' };
    }

    this.finished = true;
    return {
      type: 'completed',
      record: {
        vkUserId: this.vkUserId,
        lastName,
        firstName,
        phone,
        inn,
        consentVersion: this.settings.consentVersion,
        consentedAt: (this.settings.now ?? (() => new Date()))().toISOString(),
        status: 'approved',
      },
    };
  }
}
