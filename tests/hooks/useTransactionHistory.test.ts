import * as fs from 'fs';
import * as path from 'path';

function loadFixture(filename: string) {
  const fixturesPath = path.join(__dirname, '../fixtures', filename);
  return JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));
}

describe('useTransactionHistory Hook - Mock Data', () => {
  test('should load mock transaction data from fixture', () => {
    const fixture = loadFixture('operations.json');
    
    expect(fixture).toBeDefined();
    expect(fixture._embedded.records).toHaveLength(3);
  });

  test('should filter transactions by type from mock data', () => {
    const fixture = loadFixture('operations.json');
    const paymentTransactions = fixture._embedded.records.filter(
      (tx: any) => tx.type === 'payment'
    );
    
    expect(paymentTransactions).toHaveLength(1);
    expect(paymentTransactions[0].type).toBe('payment');
    expect(paymentTransactions[0].amount).toBe('150.0000000');
  });

  test('should handle multiple operation types correctly', () => {
    const fixture = loadFixture('operations.json');
    const records = fixture._embedded.records;
    
    const typeGroups: { [key: string]: number } = {};
    records.forEach((record: any) => {
      typeGroups[record.type] = (typeGroups[record.type] || 0) + 1;
    });
    
    expect(typeGroups['payment']).toBe(1);
    expect(typeGroups['manage_sell_offer']).toBe(1);
    expect(typeGroups['create_passive_sell_offer']).toBe(1);
  });

  test('should extract all required fields from mock data', () => {
    const fixture = loadFixture('operations.json');
    
    fixture._embedded.records.forEach((record: any) => {
      expect(record).toHaveProperty('id');
      expect(record).toHaveProperty('type');
      expect(record).toHaveProperty('source_account');
      expect(record).toHaveProperty('created_at');
      expect(record).toHaveProperty('amount');
      expect(typeof record.id).toBe('string');
      expect(typeof record.type).toBe('string');
      expect(typeof record.source_account).toBe('string');
    });
  });

  test('should ensure mock data structure matches Horizon API response format', () => {
    const fixture = loadFixture('operations.json');
    
    expect(fixture._links).toBeDefined();
    expect(fixture._links.self).toBeDefined();
    expect(fixture._embedded).toBeDefined();
    expect(fixture._embedded.records).toBeDefined();
    expect(Array.isArray(fixture._embedded.records)).toBe(true);
  });
});
