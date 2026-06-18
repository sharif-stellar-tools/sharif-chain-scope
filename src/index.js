#!/usr/bin/env node

/**
 * CLI Entry point for ChainScope-Analytics
 */

const https = require('https');

// Simple helper to fetch data from URL using standard https module (compatible with all Node.js versions)
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ChainScope-CLI/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
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
    }).on('error', (err) => {
      reject(err);
    });
  });
}

const mockOperations = [
  { id: 'op_1', type: 'payment', source_account: 'GD23...3456', details: { amount: '150.0000000', asset_code: 'XLM' }, created_at: '2026-06-17T00:00:00Z' },
  { id: 'op_2', type: 'manage_sell_offer', source_account: 'GB7A...8901', details: { amount: '320.5000000', price: '0.12' }, created_at: '2026-06-17T00:05:00Z' },
  { id: 'op_3', type: 'create_passive_sell_offer', source_account: 'GC12...4567', details: { amount: '45.0000000', price: '1.25' }, created_at: '2026-06-17T00:10:00Z' },
  { id: 'op_4', type: 'payment', source_account: 'GA45...9012', details: { amount: '500.0000000', asset_code: 'USDC' }, created_at: '2026-06-17T00:15:00Z' },
  { id: 'op_5', type: 'payment', source_account: 'GD23...3456', details: { amount: '12.5000000', asset_code: 'XLM' }, created_at: '2026-06-17T00:20:00Z' },
  { id: 'op_6', type: 'manage_sell_offer', source_account: 'GB7A...8901', details: { amount: '80.0000000', price: '0.15' }, created_at: '2026-06-17T00:25:00Z' }
];

function printHelp() {
  console.log(`
\x1b[35m  _____ _           _       _____                               
  / ____| |         (_)     / ____|                              
 | |    | |__   __ _ _ _ __ | (___   ___ ___  _ __   ___         
 | |    | '_ \\ / _\` | | '_ \\ \\___ \\ / __/ _ \\| '_ \\ / _ \\        
 | |____| | | | (_| | | | | |____) | (_| (_) | |_) |  __/        
  \\_____|_| |_|\\__,_|_|_| |_|_____/ \\___\\___/| .__/ \\___|        
                                             | |                 
                                             |_|                 \x1b[0m
  \x1b[1mChainScope CLI Analytics Tool\x1b[0m - Real-time Stellar transaction tracking.

  \x1b[1mUsage:\x1b[0m
    node src/index.js [options]

  \x1b[1mOptions:\x1b[0m
    --operation-type <type>   Filter operations by type (e.g. payment, manage_sell_offer)
    --help, -h                Show this help message

  \x1b[1mSupported Operation Types (Examples):\x1b[0m
    - payment
    - manage_sell_offer
    - create_passive_sell_offer
    - create_account
  `);
}

function pad(str, length) {
  const s = String(str || '');
  if (s.length >= length) {
    return s.slice(0, length);
  }
  return s + ' '.repeat(length - s.length);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  let operationType = null;
  const typeIndex = args.indexOf('--operation-type');
  if (typeIndex !== -1 && typeIndex + 1 < args.length) {
    operationType = args[typeIndex + 1];
  } else {
    // Check if --operation-type=value format is used
    const typeArg = args.find(arg => arg.startsWith('--operation-type='));
    if (typeArg) {
      operationType = typeArg.split('=')[1];
    }
  }

  console.log('\x1b[90m%s\x1b[0m', 'Initializing ChainScope Engine...');
  console.log('\x1b[36m%s\x1b[0m', 'Fetching operations from Stellar Horizon...');

  let operations = [];
  try {
    const horizonData = await get('https://horizon.stellar.org/operations?limit=50&order=desc');
    if (horizonData && horizonData._embedded && horizonData._embedded.records) {
      operations = horizonData._embedded.records.map(record => {
        // Extract basic info compatible with our display
        const details = {};
        if (record.amount) details.amount = record.amount;
        if (record.asset_code) details.asset_code = record.asset_code;
        if (record.price) details.price = record.price;
        return {
          id: record.id,
          type: record.type,
          source_account: record.source_account ? `${record.source_account.slice(0, 4)}...${record.source_account.slice(-4)}` : 'Unknown',
          details,
          created_at: record.created_at
        };
      });
    }
  } catch (err) {
    console.log('\x1b[33m%s\x1b[0m', `Note: Could not connect to Horizon API (${err.message}). Using offline mock stream.`);
    operations = mockOperations;
  }

  // Filter if operation type is specified
  if (operationType) {
    console.log('\x1b[34m%s\x1b[0m', `Filtering operations of type: "${operationType}"`);
    operations = operations.filter(op => op.type === operationType);
  }

  console.log('\n\x1b[1m%s\x1b[0m', '-----------------------------------------------------------------------------------------');
  console.log('\x1b[1m\x1b[32m%s %s %s %s\x1b[0m', pad('OP ID', 20), pad('TYPE', 28), pad('SOURCE', 15), pad('DETAILS', 25));
  console.log('\x1b[1m%s\x1b[0m', '-----------------------------------------------------------------------------------------');

  if (operations.length === 0) {
    console.log('  No matching operations found.');
  } else {
    operations.forEach(op => {
      let detailsStr = '';
      if (op.details.amount) {
        detailsStr += `${op.details.amount} ${op.details.asset_code || 'XLM'}`;
      }
      if (op.details.price) {
        detailsStr += ` @ ${op.details.price}`;
      }
      if (!detailsStr) {
        detailsStr = 'N/A';
      }
      console.log('%s %s %s %s', pad(op.id, 20), pad(op.type, 28), pad(op.source_account, 15), pad(detailsStr, 25));
    });
  }
  console.log('\x1b[1m%s\x1b[0m', '-----------------------------------------------------------------------------------------');
  console.log(`\x1b[32mTotal: ${operations.length} operations displayed.\x1b[0m\n`);
}

main().catch(err => {
  console.error('\x1b[31mError running CLI:\x1b[0m', err);
});
