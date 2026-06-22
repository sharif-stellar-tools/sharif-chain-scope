import nock from 'nock';
import * as fs from 'fs';
import * as path from 'path';

export const HORIZON_URLS: Record<string, string> = {
  mainnet:   'https://horizon.stellar.org',
  testnet:   'https://horizon-testnet.stellar.org',
  futurenet: 'https://horizon-futurenet.stellar.org',
};

/** Default to mainnet for backwards compatibility */
export const HORIZON_URL = HORIZON_URLS.mainnet;

export function loadFixture(filename: string) {
  const fixturesPath = path.join(__dirname, '../fixtures', filename);
  return JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));
}

export function mockHorizonOperations(network: string = 'mainnet') {
  const fixture = loadFixture('operations.json');
  const baseUrl = HORIZON_URLS[network] ?? HORIZON_URLS.mainnet;

  nock(baseUrl)
    .get('/operations?limit=50&order=desc')
    .reply(200, fixture);

  return fixture;
}

export function mockHorizonOperationsByType(type: string, network: string = 'mainnet') {
  const fixture = loadFixture('operations.json');
  const filtered = {
    ...fixture,
    _embedded: {
      records: fixture._embedded.records.filter((record: any) => record.type === type),
    },
  };
  const baseUrl = HORIZON_URLS[network] ?? HORIZON_URLS.mainnet;

  nock(baseUrl)
    .get(/\/operations.*/)
    .reply(200, filtered);

  return filtered;
}

export function mockHorizonError(network: string = 'mainnet') {
  const baseUrl = HORIZON_URLS[network] ?? HORIZON_URLS.mainnet;
  nock(baseUrl)
    .get(/\/operations.*/)
    .reply(500, { error: 'Server Error' });
}

export function cleanupMocks() {
  nock.cleanAll();
}