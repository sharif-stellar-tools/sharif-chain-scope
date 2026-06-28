#!/usr/bin/env node

/**
 * CLI Entry point for ChainScope-Analytics
 *
 * New in this version (issue #69):
 *   --network <mainnet|testnet|futurenet>   Select Stellar network (default: mainnet)
 *   Press [n] while results are on screen to cycle to the next network and refresh.
 */

const https = require('https');
const readline = require('readline');

// ─── Network Configuration ────────────────────────────────────────────────────

const NETWORKS = {
  mainnet: {
    label: 'Mainnet',
    horizonUrl: 'https://horizon.stellar.org',
    passphrase: 'Public Global Stellar Network ; September 2015',
    color: '\x1b[32m',   // green
    bgLabel: '\x1b[42m\x1b[30m', // green bg, black text
  },
  testnet: {
    label: 'Testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    passphrase: 'Test SDF Network ; September 2015',
    color: '\x1b[33m',   // yellow
    bgLabel: '\x1b[43m\x1b[30m',
  },
  futurenet: {
    label: 'Futurenet',
    horizonUrl: 'https://horizon-futurenet.stellar.org',
    passphrase: 'Test SDF Future Network ; October 2022',
    color: '\x1b[35m',   // magenta
    bgLabel: '\x1b[45m\x1b[30m',
  },
};

const NETWORK_ORDER = ['mainnet', 'testnet', 'futurenet'];

function resolveNetwork(raw) {
  const key = (raw || '').toLowerCase();
  if (!NETWORKS[key]) {
    const valid = NETWORK_ORDER.join(' | ');
    throw new Error(`Unknown network "${raw}". Valid options: ${valid}`);
  }
  return key;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ChainScope-CLI/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error('Failed to parse response JSON')); }
        } else {
          reject(new Error(`HTTP Error: ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

function pad(str, length) {
  const s = String(str || '');
  return s.length >= length ? s.slice(0, length) : s + ' '.repeat(length - s.length);
}

// ─── Mock data (offline fallback) ────────────────────────────────────────────

const mockOperations = [
  { id: 'op_1', type: 'payment',                  source_account: 'GD23...3456', details: { amount: '150.0000000', asset_code: 'XLM' },  memo: 'Payment for services',     created_at: '2026-06-17T00:00:00Z' },
  { id: 'op_2', type: 'manage_sell_offer',         source_account: 'GB7A...8901', details: { amount: '320.5000000', price: '0.12' },        memo: 'Sell order',               created_at: '2026-06-17T00:05:00Z' },
  { id: 'op_3', type: 'create_passive_sell_offer', source_account: 'GC12...4567', details: { amount: '45.0000000',  price: '1.25' },         memo: 'Passive offer',            created_at: '2026-06-17T00:10:00Z' },
  { id: 'op_4', type: 'payment',                  source_account: 'GA45...9012', details: { amount: '500.0000000', asset_code: 'USDC' }, memo: 'Subscription payment',     created_at: '2026-06-17T00:15:00Z' },
  { id: 'op_5', type: 'payment',                  source_account: 'GD23...3456', details: { amount: '12.5000000',  asset_code: 'XLM' },  memo: 'Refund',                   created_at: '2026-06-17T00:20:00Z' },
  { id: 'op_6', type: 'manage_sell_offer',         source_account: 'GB7A...8901', details: { amount: '80.0000000',  price: '0.15' },        memo: 'Large sell order',         created_at: '2026-06-17T00:25:00Z' },
  { id: 'op_7', type: 'payment',                  source_account: 'GC12...4567', details: { amount: '75.0000000',  asset_code: 'XLM' },  memo: 'Daily payout',             created_at: '2026-06-18T00:00:00Z' },
  { id: 'op_8', type: 'manage_buy_offer',          source_account: 'GA45...9012', details: { amount: '320.0000000', price: '1.00' },        memo: 'Buy order',                created_at: '2026-06-18T00:05:00Z' },
];

// ─── Help ─────────────────────────────────────────────────────────────────────

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
    --network <name>          Network to connect to: mainnet | testnet | futurenet  (default: mainnet)
    --operation-type <type>   Filter operations by type (e.g. payment, manage_sell_offer)
    --asset <code>            Filter by asset code (e.g. XLM, USDC)
    --amount-min <n>          Minimum amount filter
    --amount-max <n>          Maximum amount filter
    --memo <text>             Search memo text (fuzzy match)
    --date-from <date>        Filter by start date (ISO 8601)
    --date-to <date>          Filter by end date (ISO 8601)
    --query <text>            Search across ID, type, memo, and source account
    --watch                   Stay open; press [n] to cycle networks, [q] to quit
    --help, -h                Show this help message

  \x1b[1mExamples:\x1b[0m
    node src/index.js --network testnet
    node src/index.js --network futurenet --operation-type payment
    node src/index.js --asset USDC --amount-min 100 --amount-max 500
    node src/index.js --memo "payment" --date-from 2026-06-18
    node src/index.js --watch
  `);
}

// ─── Network banner ───────────────────────────────────────────────────────────

function printNetworkBanner(networkKey) {
  const net = NETWORKS[networkKey];
  console.log(`\n${net.bgLabel} ● ${net.label.toUpperCase()} \x1b[0m  ${net.color}${net.passphrase}\x1b[0m`);
}

// ─── Advanced filtering helpers ───────────────────────────────────────────────

function applyAdvancedFilters(operations, filters) {
  if (!filters || Object.keys(filters).length === 0) return operations;

  return operations.filter((op) => {
    if (filters.operationType && op.type !== filters.operationType) return false;

    const amount = op.details ? parseFloat(op.details.amount) : NaN;

    if (filters.asset) {
      const asset = (op.details && op.details.asset_code) || 'XLM';
      if (asset.toUpperCase() !== filters.asset.toUpperCase()) return false;
    }

    if (filters.amountMin !== undefined && (isNaN(amount) || amount < filters.amountMin)) return false;
    if (filters.amountMax !== undefined && (isNaN(amount) || amount > filters.amountMax)) return false;

    if (filters.memo) {
      const memo = (op.memo || '').toLowerCase();
      if (!memo.includes(filters.memo.toLowerCase())) return false;
    }

    if (filters.dateFrom && op.created_at < filters.dateFrom) return false;
    if (filters.dateTo && op.created_at > filters.dateTo) return false;

    if (filters.query) {
      const q = filters.query.toLowerCase();
      const haystack = [op.id, op.type, op.memo || '', op.source_account || ''].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

// ─── Core fetch + display ─────────────────────────────────────────────────────

async function fetchAndDisplay(networkKey, filters) {
  const net = NETWORKS[networkKey];

  printNetworkBanner(networkKey);
  console.log('\x1b[90m%s\x1b[0m', 'Initializing ChainScope Engine...');
  console.log(`${net.color}%s\x1b[0m`, `Fetching operations from ${net.label} Horizon...`);

  let operations = [];
  try {
    const horizonData = await get(`${net.horizonUrl}/operations?limit=50&order=desc`);
    if (horizonData && horizonData._embedded && horizonData._embedded.records) {
      operations = horizonData._embedded.records.map((record) => {
        const details = {};
        if (record.amount)     details.amount     = record.amount;
        if (record.asset_code) details.asset_code  = record.asset_code;
        if (record.price)      details.price       = record.price;
        return {
          id: record.id,
          type: record.type,
          source_account: record.source_account
            ? `${record.source_account.slice(0, 4)}...${record.source_account.slice(-4)}`
            : 'Unknown',
          details,
          created_at: record.created_at,
        };
      });
    }
  } catch (err) {
    console.log('\x1b[33m%s\x1b[0m', `Note: Could not connect to ${net.label} Horizon (${err.message}). Using offline mock stream.`);
    operations = mockOperations;
  }

  if (filters && Object.keys(filters).length > 0) {
    const filterDesc = Object.entries(filters)
      .map(([k, v]) => `${k}: "${v}"`)
      .join(', ');
    console.log('\x1b[34m%s\x1b[0m', `Applying filters: ${filterDesc}`);
    operations = applyAdvancedFilters(operations, filters);
  }

  console.log(`\n\x1b[1m${'-'.repeat(89)}\x1b[0m`);
  console.log(`\x1b[1m${net.color}%s %s %s %s\x1b[0m`,
    pad('OP ID', 20), pad('TYPE', 28), pad('SOURCE', 15), pad('DETAILS', 25));
  console.log(`\x1b[1m${'-'.repeat(89)}\x1b[0m`);

  if (operations.length === 0) {
    console.log('  No matching operations found.');
  } else {
    operations.forEach((op) => {
      let detailsStr = '';
      if (op.details.amount)  detailsStr += `${op.details.amount} ${op.details.asset_code || 'XLM'}`;
      if (op.details.price)   detailsStr += ` @ ${op.details.price}`;
      if (!detailsStr)        detailsStr  = 'N/A';
      console.log('%s %s %s %s',
        pad(op.id, 20), pad(op.type, 28), pad(op.source_account, 15), pad(detailsStr, 25));
    });
  }

  console.log(`\x1b[1m${'-'.repeat(89)}\x1b[0m`);
  console.log(`${net.color}Total: ${operations.length} operations displayed.\x1b[0m\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  // Parse --network
  let networkKey = 'mainnet';
  const netIdx = args.indexOf('--network');
  if (netIdx !== -1 && netIdx + 1 < args.length) {
    networkKey = resolveNetwork(args[netIdx + 1]);
  } else {
    const netArg = args.find((a) => a.startsWith('--network='));
    if (netArg) networkKey = resolveNetwork(netArg.split('=')[1]);
  }

  // Parse advanced filters
  function parseArg(short, long) {
    const idx = args.indexOf(long);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
    const eqArg = args.find((a) => a.startsWith(`${long}=`));
    if (eqArg) return eqArg.split('=')[1];
    return undefined;
  }

  const filters = {};
  const operationType = parseArg('-t', '--operation-type');
  if (operationType) filters.operationType = operationType;
  const asset = parseArg(null, '--asset');
  if (asset) filters.asset = asset;
  const amountMin = parseArg(null, '--amount-min');
  if (amountMin !== undefined) filters.amountMin = parseFloat(amountMin);
  const amountMax = parseArg(null, '--amount-max');
  if (amountMax !== undefined) filters.amountMax = parseFloat(amountMax);
  const memo = parseArg(null, '--memo');
  if (memo) filters.memo = memo;
  const dateFrom = parseArg(null, '--date-from');
  if (dateFrom) filters.dateFrom = dateFrom;
  const dateTo = parseArg(null, '--date-to');
  if (dateTo) filters.dateTo = dateTo;
  const query = parseArg(null, '--query');
  if (query) filters.query = query;

  const watchMode = args.includes('--watch');

  await fetchAndDisplay(networkKey, Object.keys(filters).length > 0 ? filters : null);

  if (watchMode) {
    console.log('\x1b[90mPress \x1b[1m[n]\x1b[0m\x1b[90m to cycle networks  |  \x1b[1m[q]\x1b[0m\x1b[90m to quit\x1b[0m\n');

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    process.stdin.on('keypress', async (ch, key) => {
      if (key && (key.name === 'q' || (key.ctrl && key.name === 'c'))) {
        console.log('\nGoodbye.\n');
        process.exit(0);
      }
      if (ch === 'n' || ch === 'N') {
        const idx = NETWORK_ORDER.indexOf(networkKey);
        networkKey = NETWORK_ORDER[(idx + 1) % NETWORK_ORDER.length];
        console.clear();
        await fetchAndDisplay(networkKey, Object.keys(filters).length > 0 ? filters : null);
        console.log('\x1b[90mPress \x1b[1m[n]\x1b[0m\x1b[90m to cycle networks  |  \x1b[1m[q]\x1b[0m\x1b[90m to quit\x1b[0m\n');
      }
    });
  }
}

main().catch((err) => {
  console.error('\x1b[31mError running CLI:\x1b[0m', err.message);
  process.exit(1);
});