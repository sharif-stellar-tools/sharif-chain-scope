/**
 * Multi-network configuration for ChainScope.
 * Supports Mainnet, Testnet, and Futurenet.
 */

export type NetworkName = 'mainnet' | 'testnet' | 'futurenet';

export interface NetworkConfig {
  name: NetworkName;
  label: string;
  horizonUrl: string;
  sorobanRpcUrl: string;
  passphrase: string;
  /** Display color used in the TUI header */
  color: string;
}

export const NETWORKS: Record<NetworkName, NetworkConfig> = {
  mainnet: {
    name: 'mainnet',
    label: 'Mainnet',
    horizonUrl: 'https://horizon.stellar.org',
    sorobanRpcUrl: 'https://soroban.stellar.org',
    passphrase: 'Public Global Stellar Network ; September 2015',
    color: '\x1b[32m', // green
  },
  testnet: {
    name: 'testnet',
    label: 'Testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    passphrase: 'Test SDF Network ; September 2015',
    color: '\x1b[33m', // yellow
  },
  futurenet: {
    name: 'futurenet',
    label: 'Futurenet',
    horizonUrl: 'https://horizon-futurenet.stellar.org',
    sorobanRpcUrl: 'https://rpc-futurenet.stellar.org',
    passphrase: 'Test SDF Future Network ; October 2022',
    color: '\x1b[35m', // magenta
  },
};

export const DEFAULT_NETWORK: NetworkName = 'mainnet';

/**
 * Resolves a user-supplied network string (case-insensitive) to a NetworkConfig.
 * Throws a descriptive error if the name is unrecognised.
 */
export function resolveNetwork(raw: string): NetworkConfig {
  const key = raw.toLowerCase() as NetworkName;
  if (!NETWORKS[key]) {
    const valid = Object.keys(NETWORKS).join(', ');
    throw new Error(`Unknown network "${raw}". Valid options: ${valid}`);
  }
  return NETWORKS[key];
}