import { google, sheets_v4 } from 'googleapis';

export interface ClientRecord {
  vkUserId: number;
  lastName: string;
  firstName: string;
  phone: string;
  inn: string;
  consentVersion: string;
  consentedAt: string;
  status: 'approved';
}

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

interface ServiceAccountCredentials {
  type: 'service_account';
  client_email: string;
  private_key: string;
}

function parseServiceAccount(value: string): ServiceAccountCredentials {
  const parsed: unknown = JSON.parse(value);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('type' in parsed) ||
    parsed.type !== 'service_account' ||
    !('client_email' in parsed) ||
    typeof parsed.client_email !== 'string' ||
    !('private_key' in parsed) ||
    typeof parsed.private_key !== 'string'
  ) {
    throw new Error('Google service account JSON is missing required fields.');
  }
  return {
    type: 'service_account',
    client_email: parsed.client_email,
    private_key: parsed.private_key,
  };
}

export class ClientStore {
  private readonly sheets: sheets_v4.Sheets;

  constructor(
    private readonly spreadsheetId: string,
    private readonly sheetName: string,
    serviceAccountJson: string,
    sheets?: sheets_v4.Sheets,
  ) {
    if (sheets) {
      this.sheets = sheets;
      return;
    }
    const credentials = parseServiceAccount(serviceAccountJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async hasWholesaleAccess(vkUserId: number): Promise<boolean> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.fullRange(),
    });
    const rows = response.data.values ?? [];
    this.assertHeader(rows[0]);
    return rows.slice(1).some(
      (row) => String(row[0]) === String(vkUserId) && row[7] === 'approved',
    );
  }

  async saveApprovedClient(client: ClientRecord): Promise<void> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.fullRange(),
    });
    const rows = response.data.values ?? [];
    this.assertHeader(rows[0]);
    const rowIndex = rows.findIndex(
      (row, index) => index > 0 && String(row[0]) === String(client.vkUserId),
    );
    const values = [[
      String(client.vkUserId),
      client.lastName,
      client.firstName,
      client.phone,
      client.inn,
      client.consentVersion,
      client.consentedAt,
      client.status,
    ]];
    const target = rowIndex > 0
      ? `${this.fullRange(rowIndex + 1)}`
      : this.fullRange();

    if (rowIndex > 0) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: target,
        valueInputOption: 'RAW',
        requestBody: { values },
      });
    } else {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: target,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values },
      });
    }
  }

  async deleteClient(vkUserId: number): Promise<boolean> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.fullRange(),
    });
    const rows = response.data.values ?? [];
    this.assertHeader(rows[0]);
    const rowIndex = rows.findIndex(
      (row, index) => index > 0 && String(row[0]) === String(vkUserId),
    );
    if (rowIndex <= 0) return false;
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range: this.fullRange(rowIndex + 1),
    });
    return true;
  }

  private fullRange(row?: number): string {
    const escapedSheetName = this.sheetName.replaceAll("'", "''");
    return `'${escapedSheetName}'!${row ? `A${row}:H${row}` : 'A:H'}`;
  }

  private assertHeader(row: string[] | undefined): void {
    if (!row || header.some((column, index) => row[index] !== column)) {
      throw new Error(`Google Sheet tab "${this.sheetName}" must start with the documented 8-column header.`);
    }
  }
}
