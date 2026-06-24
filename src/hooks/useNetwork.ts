import { useState, useCallback } from 'react';
import { NetworkConfig, NetworkName, NETWORKS, DEFAULT_NETWORK } from '../config/networks';

export interface UseNetworkReturn {
  network: NetworkConfig;
  setNetwork: (name: NetworkName) => void;
  cycleNetwork: () => void;
}

const NETWORK_ORDER: NetworkName[] = ['mainnet', 'testnet', 'futurenet'];

/**
 * Manages the active Stellar network selection.
 *
 * - `setNetwork(name)` — switch to a specific network by name.
 * - `cycleNetwork()`   — rotate through mainnet → testnet → futurenet (TUI hotkey support).
 */
export function useNetwork(initial: NetworkName = DEFAULT_NETWORK): UseNetworkReturn {
  const [networkName, setNetworkName] = useState<NetworkName>(initial);

  const setNetwork = useCallback((name: NetworkName) => {
    setNetworkName(name);
  }, []);

  const cycleNetwork = useCallback(() => {
    setNetworkName((current) => {
      const idx = NETWORK_ORDER.indexOf(current);
      const next = NETWORK_ORDER[(idx + 1) % NETWORK_ORDER.length];
      return next;
    });
  }, []);

  return {
    network: NETWORKS[networkName],
    setNetwork,
    cycleNetwork,
  };
}