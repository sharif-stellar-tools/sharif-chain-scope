import { NETWORKS, resolveNetwork, DEFAULT_NETWORK, NetworkName } from '../../src/config/networks';

describe('Network Configuration', () => {
  describe('NETWORKS constant', () => {
    it('should define mainnet, testnet, and futurenet', () => {
      expect(NETWORKS).toHaveProperty('mainnet');
      expect(NETWORKS).toHaveProperty('testnet');
      expect(NETWORKS).toHaveProperty('futurenet');
    });

    it('each network should have required fields', () => {
      const requiredFields = ['name', 'label', 'horizonUrl', 'sorobanRpcUrl', 'passphrase', 'color'];
      for (const [key, config] of Object.entries(NETWORKS)) {
        for (const field of requiredFields) {
          expect(config).toHaveProperty(field),
            `${key} is missing field "${field}"`;
        }
      }
    });

    it('should have distinct Horizon URLs for each network', () => {
      const urls = Object.values(NETWORKS).map((n) => n.horizonUrl);
      const uniqueUrls = new Set(urls);
      expect(uniqueUrls.size).toBe(urls.length);
    });

    it('should have distinct network passphrases', () => {
      const passphrases = Object.values(NETWORKS).map((n) => n.passphrase);
      const unique = new Set(passphrases);
      expect(unique.size).toBe(passphrases.length);
    });

    it('mainnet should point to the production Horizon endpoint', () => {
      expect(NETWORKS.mainnet.horizonUrl).toBe('https://horizon.stellar.org');
    });

    it('testnet should point to the testnet Horizon endpoint', () => {
      expect(NETWORKS.testnet.horizonUrl).toBe('https://horizon-testnet.stellar.org');
    });

    it('futurenet should point to the futurenet Horizon endpoint', () => {
      expect(NETWORKS.futurenet.horizonUrl).toBe('https://horizon-futurenet.stellar.org');
    });
  });

  describe('DEFAULT_NETWORK', () => {
    it('should be mainnet', () => {
      expect(DEFAULT_NETWORK).toBe('mainnet');
    });

    it('should exist in NETWORKS', () => {
      expect(NETWORKS).toHaveProperty(DEFAULT_NETWORK);
    });
  });

  describe('resolveNetwork()', () => {
    it('should resolve "mainnet" (exact case)', () => {
      const config = resolveNetwork('mainnet');
      expect(config.name).toBe('mainnet');
    });

    it('should resolve "testnet" (exact case)', () => {
      const config = resolveNetwork('testnet');
      expect(config.name).toBe('testnet');
    });

    it('should resolve "futurenet" (exact case)', () => {
      const config = resolveNetwork('futurenet');
      expect(config.name).toBe('futurenet');
    });

    it('should be case-insensitive — "Mainnet"', () => {
      const config = resolveNetwork('Mainnet');
      expect(config.name).toBe('mainnet');
    });

    it('should be case-insensitive — "TESTNET"', () => {
      const config = resolveNetwork('TESTNET');
      expect(config.name).toBe('testnet');
    });

    it('should be case-insensitive — "FuTuReNet"', () => {
      const config = resolveNetwork('FuTuReNet');
      expect(config.name).toBe('futurenet');
    });

    it('should throw for unknown network names', () => {
      expect(() => resolveNetwork('regtest')).toThrow(/Unknown network/);
    });

    it('should include valid options in the error message', () => {
      expect(() => resolveNetwork('devnet')).toThrow(/mainnet/);
    });

    it('should throw for empty string', () => {
      expect(() => resolveNetwork('')).toThrow(/Unknown network/);
    });
  });
});