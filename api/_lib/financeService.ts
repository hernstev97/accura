import { parseSheetsBatchResponse } from '../../src/finance/parser';
import type { FinanceDataV1 } from '../../src/finance/types';
import type { ServerConfig } from './config';
import { AppError } from './errors';
import { readGoogleFinanceWorkbook, refreshGoogleAccessToken, validateGoogleSpreadsheet } from './google';
import type { ConnectionRepository, GoogleConnection } from './repository';
import { decryptRefreshToken } from './security';

type Fetch = typeof fetch;

export async function accessForConnection(config: ServerConfig, connection: GoogleConnection, fetchImpl: Fetch = fetch) {
  const refreshToken = decryptRefreshToken(connection.encryptedRefreshToken, config.tokenEncryptionKey, connection.googleSub);
  return refreshGoogleAccessToken(config, refreshToken, fetchImpl);
}

export async function readValidatedFinanceData(config: ServerConfig, connection: GoogleConnection, spreadsheetId: string, fetchImpl: Fetch = fetch): Promise<FinanceDataV1> {
  const { accessToken } = await accessForConnection(config, connection, fetchImpl);
  const response = await readGoogleFinanceWorkbook(accessToken, spreadsheetId, fetchImpl);
  const parsed = parseSheetsBatchResponse(response);
  if (!parsed.success) {
    throw new AppError('invalid_finance_schema', 422, 'Die Tabelle entspricht nicht Finance Data Schema v1.', { issues: parsed.issues });
  }
  return parsed.data;
}

export async function validateAndSaveSpreadsheet(
  config: ServerConfig,
  repository: ConnectionRepository,
  connection: GoogleConnection,
  spreadsheetId: string,
  fetchImpl: Fetch = fetch,
) {
  const { accessToken } = await accessForConnection(config, connection, fetchImpl);
  const file = await validateGoogleSpreadsheet(accessToken, spreadsheetId, fetchImpl);
  const response = await readGoogleFinanceWorkbook(accessToken, file.id, fetchImpl);
  const parsed = parseSheetsBatchResponse(response);
  if (!parsed.success) {
    throw new AppError('invalid_finance_schema', 422, 'Die Tabelle entspricht nicht Finance Data Schema v1.', { issues: parsed.issues });
  }
  await repository.saveSpreadsheet(connection.googleSub, file.id, file.name);
  return { file, data: parsed.data };
}
