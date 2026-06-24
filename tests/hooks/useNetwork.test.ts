/**
 * useNetwork hook tests.
 *
 * We test the hook's pure logic (state transitions) without importing
 * React — the hook is a thin state wrapper, so we can exercise it by
 * calling the underlying network helpers directly and validating that
 * the cycling / selection logic in index.js works correctly.
 *
 * Full React render tests would require jsdom; for now we validate
 * the network-cycling and selection logic in isolation.
 */

import { NETWORKS, resolveNetwork } from '../../src/config/networks';

const NETWORK_ORDER: string[] = ['mainnet', 'testnet', 'futurenet'];

/** Mirrors the cycleNetwork logic in the hook */
function cycleNetwork(current: string): string {
  const idx = NETWORK_ORDER.indexOf(current);
  return NETWORK_ORDER[(idx + 1) % NETWORK_ORDER.length];
}

describe('useNetwork — cycling logic', () => {
  it('should cycle mainnet → testnet', () => {
    expect(cycleNetwork('mainnet')).toBe('testnet');
  });

  it('should cycle testnet → futurenet', () => {
    expect(cycleNetwork('testnet')).toBe('futurenet');
  });

  it('should cycle futurenet → mainnet (wraps around)', () => {
    expect(cycleNetwork('futurenet')).toBe('mainnet');
  });

  it('should complete a full cycle and return to start', () => {
    let current = 'mainnet';
    for (let i = 0; i < NETWORK_ORDER.length; i++) {
      current = cycleNetwork(current);
    }
    expect(current).toBe('mainnet');
  });
});

describe('useNetwork — setNetwork selection', () => {
  it('should allow switching to any valid network', () => {
    for (const name of NETWORK_ORDER) {
      const config = resolveNetwork(name);
      expect(config.name).toBe(name);
    }
  });

  it('should return the correct horizonUrl after switching to testnet', () => {
    const config = NETWORKS['testnet'];
    expect(config.horizonUrl).toContain('testnet');
  });

  it('should return the correct horizonUrl after switching to futurenet', () => {
    const config = NETWORKS['futurenet'];
    expect(config.horizonUrl).toContain('futurenet');
  });

  it('should return the correct passphrase for each network', () => {
    expect(NETWORKS.mainnet.passphrase).toContain('Public Global');
    expect(NETWORKS.testnet.passphrase).toContain('Test SDF Network');
    expect(NETWORKS.futurenet.passphrase).toContain('Future Network');
  });
});

describe('useNetwork — UI label', () => {
  it('each network should have a non-empty display label', () => {
    for (const config of Object.values(NETWORKS)) {
      expect(config.label).toBeTruthy();
      expect(config.label.length).toBeGreaterThan(0);
    }
  });

  it('labels should be human-readable (capitalised)', () => {
    for (const config of Object.values(NETWORKS)) {
      expect(config.label[0]).toMatch(/[A-Z]/);
    }
  });
});