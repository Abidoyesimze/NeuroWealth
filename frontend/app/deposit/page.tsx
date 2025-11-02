'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { GradientButton } from '@/components/ui/gradient-button';
import { GlowCard } from '@/components/ui/glow-card';
import { RiskSlider } from '@/components/ui/risk-slider';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { StatusBadge } from '@/components/ui/status-badge';
import { useNeuroWealthStore } from '@/lib/store';
import { fetchProjectedAPY } from '@/lib/api';
import { NETWORK_TOKENS } from '@/lib/tokens';
import { 
  createEthersSigner, 
  executeDeposit, 
  getUSDCBalance, 
  checkWalletConnection,
  switchToBaseSepolia,
  checkContractState,
  NETWORK_CONFIG
} from '@/lib/ethers-provider';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function DepositPage() {
  const { 
    riskLevel, 
    selectedToken, 
    depositAmount, 
    projectedAPY,
    isLoading,
    setRiskLevel, 
    setSelectedToken, 
    setDepositAmount, 
    setProjectedAPY,
    setLoading
  } = useNeuroWealthStore();

  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState('0');
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'confirmed' | 'failed'>('idle');
  const [contractState, setContractState] = useState<any>(null);
  const [contractStateError, setContractStateError] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    try {
      setIsBalanceLoading(true);
      setConnectionError(null);
      
      const connection = await checkWalletConnection();
      
      setIsConnected(connection.isConnected);
      setAddress(connection.address);
      setIsCorrectNetwork(connection.isCorrectNetwork);
      
      if (connection.error) {
        setConnectionError(connection.error);
      }
      
      if (connection.isConnected && connection.address) {
        await fetchBalance(connection.address);
        await checkContractStateInfo(connection.address);
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      setConnectionError('Failed to check wallet connection');
    } finally {
      setIsBalanceLoading(false);
    }
  }, []);

  // Check wallet connection on mount
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const fetchBalance = async (userAddress: string) => {
    try {
      setIsBalanceLoading(true);
      const balance = await getUSDCBalance(userAddress);
      setUsdcBalance(balance);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      toast.error('Failed to fetch USDC balance');
    } finally {
      setIsBalanceLoading(false);
    }
  };

  const checkContractStateInfo = async (userAddress: string) => {
    try {
      setContractStateError(null);
      const state = await checkContractState(userAddress);
      setContractState(state);
    } catch (error: any) {
      console.error('Contract state check failed:', error);
      setContractStateError(error?.message || 'Unknown error');
    }
  };

  const connectWallet = async () => {
    try {
      await switchToBaseSepolia();
      await checkConnection();
      toast.success('Wallet connected successfully!');
    } catch (error: any) {
      console.error('Wallet connection failed:', error);
      toast.error(`Failed to connect wallet: ${error?.message || 'Unknown error'}`);
    }
  };

  // Auto-select USDC token on mount
  useEffect(() => {
    if (!selectedToken && NETWORK_TOKENS.length > 0) {
      setSelectedToken(NETWORK_TOKENS[0].symbol); // Set USDC as default
    }
  }, [selectedToken, setSelectedToken]);

  useEffect(() => {
    const updateAPY = async () => {
      setLoading(true);
      try {
        const apy = await fetchProjectedAPY(riskLevel);
        setProjectedAPY(apy);
      } catch (error) {
        console.error('Failed to fetch APY:', error);
      } finally {
        setLoading(false);
      }
    };

    updateAPY();
  }, [riskLevel, setProjectedAPY, setLoading]);

  const handleDeposit = async () => {
    console.log('🔍 Ethers Debug: ===== DEPOSIT START =====');
    
    // Validation
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!isCorrectNetwork) {
      toast.error(`Please switch to Testnet (Chain ID: ${NETWORK_CONFIG.chainId})`);
      return;
    }

    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('Please enter a valid deposit amount');
      return;
    }

    const depositValue = parseFloat(depositAmount);
    const balanceValue = parseFloat(usdcBalance);

    if (depositValue > balanceValue) {
      toast.error(`Insufficient USDC balance. You have ${usdcBalance} USDC, trying to deposit ${depositAmount} USDC`);
      return;
    }

    setIsDepositing(true);
    setTxStatus('pending');
    setTxHash(null);

    try {
      console.log('🔍 Ethers Debug: Executing deposit...');
      console.log('🔍 Ethers Debug: Amount:', depositAmount, 'USDC');
      console.log('🔍 Ethers Debug: Address:', address);
      
      const result = await executeDeposit(depositAmount);
      
      console.log('🔍 Ethers Debug: Deposit successful!');
      console.log('🔍 Ethers Debug: Transaction hash:', result.hash);
      
      setTxHash(result.hash);
      setTxStatus('confirmed');
      
      toast.success('Deposit successful! Your funds are being optimized by AI.');
      
      // Reset form
      setDepositAmount('');
      
      // Refresh balance
      if (address) {
        await fetchBalance(address);
      }
      
    } catch (error: any) {
      console.error('🔍 Ethers Debug: Deposit failed:', error);
      setTxStatus('failed');
      
      // Detailed error handling
      const errorMessage = (error as Error)?.message || 'Unknown error';
      if (errorMessage.includes('User rejected')) {
        toast.error('Transaction rejected by user');
      } else if (errorMessage.includes('insufficient funds')) {
        toast.error('Insufficient funds for transaction');
      } else if (errorMessage.includes('execution reverted')) {
        toast.error('Contract execution failed - check contract state');
      } else if (errorMessage.includes('network')) {
        toast.error('Network connection failed');
      } else {
        toast.error(`Transaction failed: ${errorMessage}`);
      }
    } finally {
      setIsDepositing(false);
      console.log('🔍 Ethers Debug: ===== DEPOSIT END =====');
    }
  };

  const depositValue = parseFloat(depositAmount) || 0;
  const projectedEarnings = (depositValue * projectedAPY) / 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Link href="/" className="flex items-center text-gray-400 hover:text-white transition-colors mb-6">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Home
          </Link>
          
          <h1 className="font-space-grotesk text-4xl font-bold text-white mb-2">
            Make a Deposit
          </h1>
          <p className="text-gray-300">
            Choose your token, set your risk preference, and let AI optimize your yields
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Deposit Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Wallet Connection */}
            <GlowCard className="transition-transform duration-200 hover:scale-[1.02] hover:shadow-glow-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-space-grotesk text-lg font-bold text-white tracking-tight">Wallet Connection</h3>
                <button
                  onClick={checkConnection}
                  className="flex items-center text-gray-400 hover:text-green-400 transition-colors"
                  title="Refresh connection"
                  disabled={isBalanceLoading}
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${isBalanceLoading ? 'animate-spin' : ''}`} />
                  {isBalanceLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {!isConnected ? (
                <div className="text-center py-6">
                  <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                  <p className="text-gray-300 mb-4">Connect your wallet to start depositing</p>
                  <GradientButton onClick={connectWallet} className="px-6 py-2">
                    Connect Wallet
                  </GradientButton>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-400/10 border border-green-400/20 rounded-xl">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status="success">Wallet Connected</StatusBadge>
                      </div>
                      <div className="text-gray-300 text-sm">
                        {address ? `${address.slice(0,6)}...${address.slice(-4)}` : 'Unknown address'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">{usdcBalance} USDC</div>
                      <div className="text-gray-400 text-sm">Balance</div>
                    </div>
                  </div>

                  {!isCorrectNetwork && (
                    <div className="p-4 bg-red-400/10 border border-red-400/20 rounded-xl">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                        <div>
                          <div className="text-red-400 font-semibold">Wrong Network</div>
                          <div className="text-gray-300 text-sm">
                            Please switch to Testnet (Chain ID: {NETWORK_CONFIG.chainId})
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {connectionError && (
                    <div className="p-4 bg-red-400/10 border border-red-400/20 rounded-xl">
                      <div className="text-red-400 font-semibold">Connection Error</div>
                      <div className="text-gray-300 text-sm">{connectionError}</div>
                    </div>
                  )}
                </div>
              )}
            </GlowCard>

            {/* Token Selection */}
            <GlowCard className="transition-transform duration-200 hover:scale-[1.02] hover:shadow-glow-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-space-grotesk text-lg font-bold text-white tracking-tight">USDC Token</h3>
              </div>
              
              {/* USDC Token Selection */}
              <div className="mb-6">
                <div className="grid grid-cols-1 gap-3">
                  {NETWORK_TOKENS.map((token) => (
                    <button
                      key={token.symbol}
                      onClick={() => setSelectedToken(token.symbol)}
                      className={`p-6 rounded-xl border-2 font-space-grotesk font-semibold text-xl transition-all shadow-glow-card focus:outline-none ${
                        selectedToken === token.symbol
                          ? 'border-gradient-to-r from-green-400 via-blue-400 to-purple-400 animate-gradient-x ring-2 ring-green-400/40 shadow-lg scale-105'
                          : 'border-green-400/50 bg-green-400/10 hover:border-green-400 hover:bg-green-400/20'
                      }`}
                    >
                      <div className="text-white font-bold text-2xl">{token.symbol}</div>
                      <div className="text-lg text-gray-300 mt-1">{token.name}</div>
                      <div className="text-lg text-gray-200 mt-2">
                        Balance: {isBalanceLoading ? 'Loading...' : `${parseFloat(usdcBalance).toFixed(4)} USDC`}
                      </div>
                      <div className="text-sm text-green-400 mt-2 flex items-center">
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                        ✓ Native Testnet Token - Ready to Use
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* USDC Info */}
              <div className="mt-4 p-4 bg-green-400/10 border border-green-400/20 rounded-xl">
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h4 className="text-green-400 font-semibold text-sm">USDC Token</h4>
                    <p className="text-gray-300 text-sm mt-1">
                      Deposit USDC to the NeuroWealth Vault. Token approval required for ERC20.
                    </p>
                    <div className="mt-2 text-xs text-gray-400">
                      <strong>Need USDC?</strong> Bridge from Ethereum or buy on Base DEXs
                    </div>
                  </div>
                </div>
              </div>
            </GlowCard>

            {/* Amount Input */}
            <GlowCard>
              <h3 className="font-semibold text-white mb-4">Deposit Amount</h3>
              <div className="relative">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-green-400"
                  disabled={!isConnected || !isCorrectNetwork}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  USDC
                </div>
              </div>
              
              <div className="flex justify-between mt-2 text-sm">
                <span className="text-gray-400">
                  Available: {isBalanceLoading ? 'Loading...' : `${parseFloat(usdcBalance).toFixed(2)} USDC`}
                </span>
                <button 
                  onClick={() => setDepositAmount(usdcBalance)}
                  className="text-green-400 hover:text-white transition-colors"
                  disabled={!isConnected || !isCorrectNetwork}
                >
                  Max
                </button>
              </div>
            </GlowCard>

            {/* Risk Slider */}
            <GlowCard className="transition-transform duration-200 hover:scale-[1.02] hover:shadow-glow-card">
              <RiskSlider value={riskLevel} onChange={setRiskLevel} />
            </GlowCard>

            {/* Contract State */}
            {isConnected && address && (
              <GlowCard>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">Contract State</h3>
                  <button
                    onClick={() => checkContractStateInfo(address)}
                    className="flex items-center text-gray-400 hover:text-green-400 transition-colors"
                    title="Refresh contract state"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Refresh
                  </button>
                </div>

                {contractStateError ? (
                  <div className="p-4 bg-red-400/10 border border-red-400/20 rounded-xl">
                    <div className="text-red-400 font-semibold mb-2">Contract Issue Detected</div>
                    <div className="text-gray-300 text-sm mb-3">{contractStateError}</div>
                    <div className="text-xs text-gray-400">
                      <strong>Likely Cause:</strong> MindStaking contract at address 0x3F615Fd4Ce5E07cC92a17A8c704620a0Bf04f8F3 is not working properly.
                    </div>
                  </div>
                ) : contractState ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Contract Status</span>
                      <span className={`font-semibold ${contractState.isPaused ? 'text-red-400' : 'text-green-400'}`}>
                        {contractState.isPaused ? 'Paused' : 'Active'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Min Deposit</span>
                      <span className="text-white font-semibold">{contractState.minDeposit} USDC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max Deposit</span>
                      <span className="text-white font-semibold">{contractState.maxDeposit} USDC</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      <div>MindStaking: {contractState.mindStakingAddress}</div>
                      <div>Yield Protocol: {contractState.mockProtocolAddress}</div>
                      <div className="mt-2">
                        <span className="text-gray-500">Protocol Status: </span>
                        <span className={`font-semibold ${
                          contractState.mockProtocolStatus?.includes('Working') ? 'text-green-400' :
                          contractState.mockProtocolStatus?.includes('Error') ? 'text-red-400' :
                          'text-yellow-400'
                        }`}>
                          {contractState.mockProtocolStatus}
                        </span>
                      </div>
                      <div className="mt-1">
                        <span className="text-gray-500">Protocol Balance: </span>
                        <span className="text-blue-400 font-semibold">
                          {contractState.protocolBalance} USDC
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="text-gray-400">Checking contract state...</div>
                  </div>
                )}
              </GlowCard>
            )}

            {/* Transaction Status */}
            {txStatus !== 'idle' && (
              <GlowCard>
                <h3 className="font-semibold text-white mb-4">Transaction Status</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      txStatus === 'pending' ? 'bg-yellow-400 animate-pulse' :
                      txStatus === 'confirmed' ? 'bg-green-400' :
                      'bg-red-400'
                    }`}></div>
                    <span className="text-gray-300">
                      {txStatus === 'pending' ? 'Transaction pending...' :
                       txStatus === 'confirmed' ? 'Transaction confirmed!' :
                       'Transaction failed'}
                    </span>
                  </div>
                  {txHash && (
                    <div className="text-sm">
                      <span className="text-gray-400">Hash: </span>
                      <a 
                        href={`https://explorer.network/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 break-all"
                      >
                        {txHash}
                      </a>
                    </div>
                  )}
                </div>
              </GlowCard>
            )}

            {/* Deposit Button */}
            <GradientButton
              onClick={handleDeposit}
              disabled={!isConnected || !isCorrectNetwork || isDepositing || !depositAmount || txStatus === 'pending' || !!contractStateError}
              className="w-full font-space-grotesk text-lg py-4 shadow-glow-card transition-transform hover:scale-105"
              size="lg"
            >
              {isDepositing ? (
                <div className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" />
                  Processing Deposit...
                </div>
              ) : 
               !isConnected ? 'Connect Wallet First' :
               !isCorrectNetwork ? 'Switch to Testnet' :
               contractStateError ? 'Contract Issue - Cannot Deposit' :
               'Deposit & Optimize'}
            </GradientButton>
          </div>

          {/* Preview Sidebar */}
          <div className="space-y-6">
            <GlowCard className="transition-transform duration-200 hover:scale-[1.02] hover:shadow-glow-card">
              <h3 className="font-space-grotesk text-lg font-bold text-white mb-4 flex items-center tracking-tight">
                <TrendingUp className="w-6 h-6 mr-2 text-green-400 animate-pulse" />
                Projection
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-inter">Deposit Amount</span>
                  <span className="text-white font-ibm-plex-mono font-semibold">
                    {depositValue.toLocaleString()} USDC
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-slate-400 font-inter">Projected APY</span>
                  <span className="text-green-400 font-ibm-plex-mono font-semibold">
                    {isLoading ? '...' : `${projectedAPY.toFixed(1)}%`}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-slate-400 font-inter">Annual Earnings</span>
                  <span className="text-blue-400 font-ibm-plex-mono font-semibold">
                    {projectedEarnings.toLocaleString()} USDC
                  </span>
                </div>
              </div>
            </GlowCard>

            <GlowCard className="transition-transform duration-200 hover:scale-[1.02] hover:shadow-glow-card">
              <h4 className="font-space-grotesk text-base font-bold text-white mb-3 tracking-tight">How it works</h4>
              <div className="space-y-3 text-sm text-gray-300 font-inter">
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0 animate-pulse"></div>
                  <p>Deposit USDC to NeuroWealth Vault</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0 animate-pulse"></div>
                  <p>AI analyzes DeFi protocols</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0 animate-pulse"></div>
                  <p>Funds deployed to highest-yield opportunities</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0 animate-pulse"></div>
                  <p>Continuous optimization & rebalancing</p>
                </div>
              </div>
            </GlowCard>

            <GlowCard className="transition-transform duration-200 hover:scale-[1.02] hover:shadow-glow-card">
              <h4 className="font-space-grotesk text-base font-bold text-white mb-3 tracking-tight">Ethers.js Benefits</h4>
              <div className="space-y-3 text-sm text-gray-300 font-inter">
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Simpler error handling</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Better gas estimation</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p>More reliable transaction execution</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Direct MetaMask integration</p>
                </div>
              </div>
            </GlowCard>
          </div>
        </div>
      </div>
    </div>
  );
}
