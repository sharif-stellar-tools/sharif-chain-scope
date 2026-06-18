import nock from 'nock';
import * as fs from 'fs';
import * as path from 'path';

const HORIZON_URL = 'https://horizon.stellar.org';

export function loadFixture(filename: string) {
  const fixturesPath = path.join(__dirname, '../fixtures', filename);
  return JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));
}

export function mockHorizonOperations() {
  const fixture = loadFixture('operations.json');
  
  nock(HORIZON_URL)
    .get('/operations?limit=50&order=desc')
    .reply(200, fixture);

  return fixture;
}

export function mockHorizonOperationsByType(type: string) {
  const fixture = loadFixture('operations.json');
  const filtered = {
    ...fixture,
    _embedded: {
      records: fixture._embedded.records.filter((record: any) => record.type === type)
    }
  };

  nock(HORIZON_URL)
    .get(/\/operations.*/)
    .reply(200, filtered);

  return filtered;
}

export function mockHorizonError() {
  nock(HORIZON_URL)
    .get(/\/operations.*/)
    .reply(500, { error: 'Server Error' });
}

export function cleanupMocks() {
  nock.cleanAll();
}
