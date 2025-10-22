import { NEURO_WEALTH_VAULT_ABI } from './neuro-wealth-vault';
import { SIMPLIFIED_VAULT_ABI } from './simplified-vault';
import { AI_STRATEGY_MANAGER_ABI } from './ai-strategy-manager';
import { FEE_MANAGER_ABI } from './fee-manager';

export const NeuroWealthVaultContract = {
  abi: SIMPLIFIED_VAULT_ABI,
  address: '0x5E19885955D4062369479998753C29874f1E66c6', // Base mainnet - Updated deployment
};

export const AiStrategyManagerContract = {
  abi: AI_STRATEGY_MANAGER_ABI,
  address: '0x4B823920717272C0Ed7e248Ac5AEff7927D8FE7C', // Base mainnet - Updated deployment
};

export const AiStrategyManagerV2Contract = {
  abi: AI_STRATEGY_MANAGER_ABI, // Using same ABI for now
  address: '0xE75CA0E9C69DE3a0979DD6A3dac384b398580c92', // Base mainnet - Updated deployment
};

export const FeeManagerContract = {
  abi: FEE_MANAGER_ABI,
  address: '0x0000000000000000000000000000000000000000', // Not deployed yet
};

// Base Protocol Integration Contract
export const BaseProtocolIntegrationContract = {
  abi: [], // Will be added after deployment
  address: '0x0000000000000000000000000000000000000000', // Will be updated after deployment
};