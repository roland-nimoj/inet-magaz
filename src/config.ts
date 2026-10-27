import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalGroupId(): number | undefined {
  const value = process.env.VK_GROUP_ID?.trim();
  if (!value) return undefined;
  if (!/^\d+$/.test(value) || Number(value) <= 0) {
    throw new Error('VK_GROUP_ID must be a positive integer.');
  }
  return Number(value);
}

export const config = {
  vkToken: required('VK_TOKEN'),
  vkGroupId: optionalGroupId(),
  consentText: required('PERSONAL_DATA_CONSENT_TEXT'),
  consentVersion: required('PERSONAL_DATA_CONSENT_VERSION'),
  googleServiceAccountJson: required('GOOGLE_SERVICE_ACCOUNT_JSON'),
  googleSpreadsheetId: required('GOOGLE_SPREADSHEET_ID'),
  googleSheetName: process.env.GOOGLE_SHEET_NAME?.trim() || 'Clients',
  catalogPath: process.env.CATALOG_PATH?.trim() || './catalog.csv',
};
