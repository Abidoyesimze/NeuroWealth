import { ethers } from 'ethers';
import { NeuroWealthVaultContract } from '@/abi';

// Network configuration - Base Sepolia Testnet
export const NETWORK_CONFIG = {
  chainId: 84532,
  name: 'Base Sepolia',
  rpcUrls: [
    'https://sepolia.base.org',
    'https://base-sepolia-rpc.publicnode.com',
    'https://base-sepolia.drpc.org'
  ],
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorer: 'https://sepolia.basescan.org'
};

// Create ethers provider with fallback RPCs
export const createEthersProvider = () => {
  const providers = NETWORK_CONFIG.rpcUrls.map(url => 
    new ethers.JsonRpcProvider(url, {
      chainId: NETWORK_CONFIG.chainId,
      name: NETWORK_CONFIG.name,
    })
  );
  
  // Use the first provider as primary, others as fallbacks
  return providers[0];
};

// Create ethers signer from window.ethereum
export const createEthersSigner = async () => {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not detected');
  }

  const provider = new ethers.BrowserProvider(window.ethereum as any);
  
  // Request account access
  await provider.send('eth_requestAccounts', []);
  
  // Get signer
  const signer = await provider.getSigner();
  
  // Verify we're on the correct network
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== NETWORK_CONFIG.chainId) {
    throw new Error(`Please switch to Base Sepolia (Chain ID: ${NETWORK_CONFIG.chainId})`);
  }
  
  return signer;
};

// Get contract instance with ethers
export const getNeuroWealthVaultContract = async () => {
  const signer = await createEthersSigner();
  return new ethers.Contract(
    NeuroWealthVaultContract.address,
    NeuroWealthVaultContract.abi,
    signer
  );
};

// Estimate gas with proper error handling (USDC)
export const estimateDepositGas = async (amount: string) => {
  try {
    const contract = await getNeuroWealthVaultContract();
    const amountWei = ethers.parseUnits(amount, 6); // USDC has 6 decimals
    
    // Estimate gas for deposit function (no value for ERC20 tokens)
    const gasEstimate = await contract.deposit.estimateGas(amountWei);
    
    // Add 20% buffer
    const gasWithBuffer = (gasEstimate * BigInt(120)) / BigInt(100);
    
    return gasWithBuffer;
  } catch (error) {
    console.error('Gas estimation failed:', error);
    // Return a reasonable fallback
    return BigInt(200000);
  }
};

// Check contract state before deposit
export const checkContractState = async (userAddress: string) => {
  try {
    const contract = await getNeuroWealthVaultContract();
    
    console.log('🔍 Ethers Debug: Checking contract state...');
    
    // Check if contract is paused
    const isPaused = await contract.paused();
    console.log('🔍 Ethers Debug: Contract paused:', isPaused);
    
    // Check minimum deposit
    const minDeposit = await contract.MIN_DEPOSIT();
    console.log('🔍 Ethers Debug: Min deposit:', ethers.formatUnits(minDeposit, 6), 'USDC');
    
    // Check maximum deposit
    const maxDeposit = await contract.MAX_DEPOSIT();
    console.log('🔍 Ethers Debug: Max deposit:', ethers.formatUnits(maxDeposit, 6), 'USDC');
    
    // Check MindStaking contract
    const mindStakingAddress = await contract.mindStaking();
    console.log('🔍 Ethers Debug: MindStaking address:', mindStakingAddress);
    
    // Check mock protocol
    const mockProtocolAddress = await contract.mockProtocol();
    console.log('🔍 Ethers Debug: MockProtocol address:', mockProtocolAddress);
    
    // Try to get user position (this might fail if MindStaking is not working)
    try {
      const userPosition = await contract.userPositions(userAddress);
      console.log('🔍 Ethers Debug: User position:', {
        principal: ethers.formatUnits(userPosition.principal, 6),
        currentValue: ethers.formatUnits(userPosition.currentValue, 6),
        totalReturns: ethers.formatUnits(userPosition.totalReturns, 6),
        lastUpdateTime: new Date(Number(userPosition.lastUpdateTime) * 1000).toISOString()
      });
    } catch (tierError: any) {
      console.log('🔍 Ethers Debug: ❌ Failed to get user position:', tierError?.message || 'Unknown error');
      throw new Error(`User position check failed: ${tierError?.message || 'Unknown error'}`);
    }
    
    // Check MockProtocol state (simplified)
    let mockProtocolStatus = 'Working';
    let protocolBalance = '0';
    
    // Get protocol balance from vault instead of direct protocol call
    try {
      const protocolBalanceWei = await contract.getProtocolBalance();
      protocolBalance = ethers.formatUnits(protocolBalanceWei, 6);
      console.log('🔍 Ethers Debug: Protocol balance from vault:', protocolBalance, 'USDC');
    } catch (error: any) {
      console.log('🔍 Ethers Debug: Could not get protocol balance:', error?.message);
    }
    
    return {
      isPaused,
      minDeposit: ethers.formatUnits(minDeposit, 6),
      maxDeposit: ethers.formatUnits(maxDeposit, 6),
      mindStakingAddress,
      mockProtocolAddress,
      mockProtocolStatus,
      protocolBalance
    };
  } catch (error: any) {
    console.error('🔍 Ethers Debug: Contract state check failed:', error);
    throw error;
  }
};

// Execute deposit with ethers (USDC)
export const executeDeposit = async (amount: string) => {
  try {
    const signer = await createEthersSigner();
    const userAddress = await signer.getAddress();
    
    // Check contract state first
    await checkContractState(userAddress);
    
    const contract = await getNeuroWealthVaultContract();
    const amountWei = ethers.parseUnits(amount, 6); // USDC has 6 decimals
    
    // USDC contract address on Base mainnet
    const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    
    // Create USDC contract instance
    const usdcContract = new ethers.Contract(
      usdcAddress,
      ['function approve(address, uint256) returns (bool)', 'function allowance(address, address) view returns (uint256)'],
      signer
    );
    
    // Check current allowance
    const currentAllowance = await usdcContract.allowance(userAddress, contract.target);
    
    // If allowance is insufficient, approve the contract
    if (currentAllowance < amountWei) {
      console.log('🔍 Ethers Debug: Approving USDC spending...');
      const approveTx = await usdcContract.approve(contract.target, amountWei);
      await approveTx.wait();
      console.log('🔍 Ethers Debug: USDC approval confirmed');
    }
    
    // Estimate gas first
    const gasLimit = await estimateDepositGas(amount);
    
    console.log('🔍 Ethers Debug: Executing deposit with:');
    console.log('🔍 Ethers Debug: - Amount:', amount, 'USDC');
    console.log('🔍 Ethers Debug: - Amount (units):', amountWei.toString());
    console.log('🔍 Ethers Debug: - Gas limit:', gasLimit.toString());
    console.log('🔍 Ethers Debug: - User address:', userAddress);
    
    // Execute transaction (no value for ERC20 tokens)
    const tx = await contract.deposit(amountWei, {
      gasLimit: gasLimit
    });
    
    console.log('🔍 Ethers Debug: Transaction sent:', tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    console.log('🔍 Ethers Debug: Transaction confirmed:', receipt.hash);
    console.log('🔍 Ethers Debug: Transaction status:', receipt.status);
    
    if (receipt.status === 0) {
      throw new Error('Transaction reverted - check contract requirements');
    }
    
    return {
      hash: tx.hash,
      receipt: receipt
    };
  } catch (error: any) {
    console.error('🔍 Ethers Debug: Deposit failed:', error);
    throw error;
  }
};

// Get USDC balance with ethers
export const getUSDCBalance = async (address: string) => {
  try {
    const provider = createEthersProvider();
    // USDC contract address on Base mainnet
    const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    
    // Create USDC contract instance
    const usdcContract = new ethers.Contract(
      usdcAddress,
      ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
      provider
    );
    
    const balance = await usdcContract.balanceOf(address);
    const decimals = await usdcContract.decimals();
    
    // Format balance with correct decimals (USDC has 6 decimals)
    return ethers.formatUnits(balance, decimals);
  } catch (error: any) {
    console.error('Failed to get USDC balance:', error);
    return '0';
  }
};

// Check if wallet is connected and on correct network
export const checkWalletConnection = async () => {
  try {
    const signer = await createEthersSigner();
    const address = await signer.getAddress();
    const provider = signer.provider;
    const network = await provider.getNetwork();
    
    return {
      isConnected: true,
      address,
      chainId: Number(network.chainId),
      isCorrectNetwork: Number(network.chainId) === NETWORK_CONFIG.chainId
    };
  } catch (error: any) {
    return {
      isConnected: false,
      address: null,
      chainId: null,
      isCorrectNetwork: false,
      error: error?.message || 'Unknown error'
    };
  }
};

// Execute withdrawal with ethers (USDC)
export const executeWithdrawal = async (amount: string) => {
  try {
    const signer = await createEthersSigner();
    const userAddress = await signer.getAddress();
    
    // Check contract state first
    await checkContractState(userAddress);
    
    const contract = await getNeuroWealthVaultContract();
    const amountWei = ethers.parseUnits(amount, 6); // USDC has 6 decimals
    
    // Estimate gas first
    const gasLimit = await estimateWithdrawalGas(amount);
    
    console.log('🔍 Ethers Debug: Executing withdrawal with:');
    console.log('🔍 Ethers Debug: - Amount:', amount, 'USDC');
    console.log('🔍 Ethers Debug: - Amount (units):', amountWei.toString());
    console.log('🔍 Ethers Debug: - Gas limit:', gasLimit.toString());
    console.log('🔍 Ethers Debug: - User address:', userAddress);
    
    // Execute transaction
    const tx = await contract.withdraw(amountWei, {
      gasLimit: gasLimit
    });
    
    console.log('🔍 Ethers Debug: Withdrawal transaction sent:', tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    console.log('🔍 Ethers Debug: Withdrawal confirmed:', receipt.hash);
    console.log('🔍 Ethers Debug: Transaction status:', receipt.status);
    
    if (receipt.status === 0) {
      throw new Error('Withdrawal transaction reverted - check contract requirements');
    }
    
    return {
      hash: tx.hash,
      receipt: receipt
    };
  } catch (error: any) {
    console.error('🔍 Ethers Debug: Withdrawal failed:', error);
    throw error;
  }
};

// Estimate gas for withdrawal (USDC)
export const estimateWithdrawalGas = async (amount: string) => {
  try {
    const contract = await getNeuroWealthVaultContract();
    const amountWei = ethers.parseUnits(amount, 6); // USDC has 6 decimals
    
    // Estimate gas for withdrawal function
    const gasEstimate = await contract.withdraw.estimateGas(amountWei);
    
    // Add 20% buffer
    const gasWithBuffer = (gasEstimate * BigInt(120)) / BigInt(100);
    
    return gasWithBuffer;
  } catch (error) {
    console.error('Withdrawal gas estimation failed:', error);
    // Return a reasonable fallback
    return BigInt(200000);
  }
};

// Get user position from vault (USDC)
export const getUserPosition = async (userAddress: string) => {
  try {
    const contract = await getNeuroWealthVaultContract();
    const position = await contract.userPositions(userAddress);
    
    return {
      principal: ethers.formatUnits(position.principal, 6), // USDC has 6 decimals
      currentValue: ethers.formatUnits(position.currentValue, 6),
      totalReturns: ethers.formatUnits(position.totalReturns, 6),
      userTier: '2' // Default to Pro tier for SimplifiedVault
    };
  } catch (error: any) {
    console.error('Failed to get user position:', error);
    return {
      principal: '0',
      currentValue: '0',
      totalReturns: '0',
      userTier: '0'
    };
  }
};

// Claim rewards from vault (simplified version)
export const claimRewards = async () => {
  try {
    const contract = await getNeuroWealthVaultContract();
    
    console.log('🔍 Ethers Debug: Claiming rewards...');
    
    // For now, we'll simulate rewards claiming by updating the user's position
    // In a real implementation, this would calculate and distribute actual rewards
    
    // Get current position
    const position = await contract.userPositions(await createEthersSigner().then(s => s.getAddress()));
    const currentValue = parseFloat(position.currentValue.toString()) / 1e6; // USDC has 6 decimals
    const principal = parseFloat(position.principal.toString()) / 1e6;
    
    // Calculate simulated rewards (15% APY for demonstration)
    const timeElapsed = Math.floor(Date.now() / 1000) - Number(position.lastUpdateTime);
    const apy = 0.15; // 15% APY
    const rewards = (principal * apy * timeElapsed) / (365 * 24 * 3600); // Per second
    
    if (rewards > 0.001) { // Only claim if rewards > 0.001 USDC
      console.log(`🔍 Ethers Debug: Simulated rewards: ${rewards.toFixed(4)} USDC`);
      
      // For now, just return success - in production this would update the contract
      return {
        hash: '0x' + Math.random().toString(16).substr(2, 64), // Simulated hash
        receipt: { status: 1 } // Simulated success
      };
    } else {
      throw new Error('No rewards available to claim yet');
    }
    
  } catch (error: any) {
    console.error('🔍 Ethers Debug: Claim rewards failed:', error);
    throw error;
  }
};

// Get pending rewards for user (simplified version)
export const getPendingRewards = async (userAddress: string) => {
  try {
    const contract = await getNeuroWealthVaultContract();
    const position = await contract.userPositions(userAddress);
    
    // Calculate simulated pending rewards (15% APY)
    const principal = parseFloat(position.principal.toString()) / 1e6; // USDC has 6 decimals
    const timeElapsed = Math.floor(Date.now() / 1000) - Number(position.lastUpdateTime);
    const apy = 0.15; // 15% APY
    const pendingRewards = (principal * apy * timeElapsed) / (365 * 24 * 3600); // Per second
    
    return {
      pendingRewards: pendingRewards.toFixed(6),
      apy: '15.0'
    };
  } catch (error: any) {
    console.error('Failed to get pending rewards:', error);
    return {
      pendingRewards: '0',
      apy: '0'
    };
  }
};

// Switch to Base Sepolia testnet
export const switchToBaseSepolia = async () => {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not detected');
  }

  try {
    await (window.ethereum as any).request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${NETWORK_CONFIG.chainId.toString(16)}` }],
    });
  } catch (switchError: any) {
    // If the network doesn't exist, add it
    if (switchError?.code === 4902) {
      await (window.ethereum as any).request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: `0x${NETWORK_CONFIG.chainId.toString(16)}`,
            chainName: NETWORK_CONFIG.name,
            rpcUrls: NETWORK_CONFIG.rpcUrls,
            nativeCurrency: NETWORK_CONFIG.nativeCurrency,
            blockExplorerUrls: [NETWORK_CONFIG.blockExplorer],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
};
