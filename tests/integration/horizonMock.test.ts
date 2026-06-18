import nock from 'nock';
import * as fs from 'fs';
import * as path from 'path';

const HORIZON_URL = 'https://horizon.stellar.org';

function loadFixture(filename: string) {
  const fixturesPath = path.join(__dirname, '../fixtures', filename);
  return JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));
}

function fetchOperations(url: string) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    https.get(url, { headers: { 'User-Agent': 'ChainScope-CLI/1.0' } }, (res: any) => {
      let data = '';
      res.on('data', (chunk: string) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Failed to parse response JSON'));
          }
        } else {
          reject(new Error(`HTTP Error: ${res.statusCode}`));
        }
      });
    }).on('error', (err: Error) => {
      reject(err);
    });
  });
}

describe('Horizon API Mocking', () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test('should fetch operations from mock Horizon server', async () => {
    const fixture = loadFixture('operations.json');
    
    nock(HORIZON_URL)
      .get('/operations?limit=50&order=desc')
      .reply(200, fixture);

    const result = await fetchOperations(`${HORIZON_URL}/operations?limit=50&order=desc`);
    
    expect(result._embedded.records).toHaveLength(3);
    expect(result._embedded.records[0].type).toBe('payment');
    expect(result._embedded.records[0].amount).toBe('150.0000000');
  });

  test('should handle multiple operation types from mock', async () => {
    const fixture = loadFixture('operations.json');
    
    nock(HORIZON_URL)
      .get(/\/operations.*/)
      .reply(200, fixture);

    const result = await fetchOperations(`${HORIZON_URL}/operations?limit=50&order=desc`);
    
    const types = result._embedded.records.map((r: any) => r.type);
    expect(types).toContain('payment');
    expect(types).toContain('manage_sell_offer');
    expect(types).toContain('create_passive_sell_offer');
  });

  test('should mock Horizon server error responses', async () => {
    nock(HORIZON_URL)
      .get(/\/operations.*/)
      .reply(500, { error: 'Server Error' });

    await expect(fetchOperations(`${HORIZON_URL}/operations?limit=50&order=desc`))
      .rejects
      .toThrow('HTTP Error: 500');
  });

  test('fixture contains valid ledger data', () => {
    const fixture = loadFixture('operations.json');
    
    expect(fixture._embedded).toBeDefined();
    expect(fixture._embedded.records).toBeDefined();
    expect(Array.isArray(fixture._embedded.records)).toBe(true);
    
    fixture._embedded.records.forEach((record: any) => {
      expect(record.id).toBeDefined();
      expect(record.type).toBeDefined();
      expect(record.source_account).toBeDefined();
      expect(record.created_at).toBeDefined();
    });
  });

  test('should run tests offline without hitting live network', async () => {
    nock.disableNetConnect();
    const fixture = loadFixture('operations.json');
    
    nock(HORIZON_URL)
      .get('/operations?limit=50&order=desc')
      .reply(200, fixture);

    const result = await fetchOperations(`${HORIZON_URL}/operations?limit=50&order=desc`);
    expect(result._embedded.records).toHaveLength(3);
    
    nock.enableNetConnect();
  });
});
