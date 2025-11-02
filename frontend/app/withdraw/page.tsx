'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, TrendingDown, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { GradientButton } from '@/components/ui/gradient-button';
import { GlowCard } from '@/components/ui/glow-card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { StatusBadge } from '@/components/ui/status-badge';
import { 
  createEthersSigner, 
  executeWithdrawal, 
  getUSDCBalance, 
  checkWalletConnection,
  switchToBaseSepolia,
  getUserPosition,
  NETWORK_CONFIG
} from '@/lib/ethers-provider';
import Link from 'next/link';
import toast from 'react-hot-toast';

type WithdrawalType = 'partial' | 'full';

export default function WithdrawPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState('0');
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'confirmed' | 'failed'>('idle');
  
  // User position data
  const [userPosition, setUserPosition] = useState({
    principal: '0',
    currentValue: '0',
    totalReturns: '0',
    userTier: '0'
  });
  
  // Withdrawal form
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalType, setWithdrawalType] = useState<WithdrawalType>('partial');

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
        await fetchUserPosition(connection.address);
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

  const fetchUserPosition = async (userAddress: string) => {
    try {
      console.log('🔍 Withdrawal Debug: Fetching user position for:', userAddress);
      const position = await getUserPosition(userAddress);
      console.log('🔍 Withdrawal Debug: Position data:', position);
      setUserPosition(position);
    } catch (error) {
      console.error('Failed to fetch user position:', error);
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

  const handleWithdrawal = async () => {
    console.log('🔍 Ethers Debug: ===== WITHDRAWAL START =====');
    
    // Validation
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!isCorrectNetwork) {
      toast.error(`Please switch to Testnet (Chain ID: ${NETWORK_CONFIG.chainId})`);
      return;
    }

    if (!userPosition || parseFloat(userPosition.currentValue) <= 0) {
      toast.error('No position found to withdraw');
      return;
    }

    let withdrawAmount: string;
    if (withdrawalType === 'full') {
      withdrawAmount = userPosition.currentValue;
    } else {
      if (!withdrawalAmount || parseFloat(withdrawalAmount) <= 0) {
        toast.error('Please enter a valid withdrawal amount');
        return;
      }
      
      const requestedAmount = parseFloat(withdrawalAmount);
      const availableAmount = parseFloat(userPosition.currentValue);
      
      if (requestedAmount > availableAmount) {
        toast.error(`Insufficient balance. Available: ${availableAmount.toFixed(4)} USDC`);
        return;
      }
      
      withdrawAmount = withdrawalAmount;
    }

    setIsWithdrawing(true);
    setTxStatus('pending');
    setTxHash(null);

    try {
      console.log('🔍 Ethers Debug: Executing withdrawal...');
      console.log('🔍 Ethers Debug: Amount:', withdrawAmount, 'USDC');
      console.log('🔍 Ethers Debug: Type:', withdrawalType);
      console.log('🔍 Ethers Debug: Address:', address);
      
      const result = await executeWithdrawal(withdrawAmount);
      
      console.log('🔍 Ethers Debug: Withdrawal successful!');
      console.log('🔍 Ethers Debug: Transaction hash:', result.hash);
      
      setTxHash(result.hash);
      setTxStatus('confirmed');
      
      toast.success('Withdrawal successful! Your USDC tokens have been returned.');
      
      // Reset form
      setWithdrawalAmount('');
      setWithdrawalType('partial');
      
      // Refresh data
      if (address) {
        await fetchBalance(address);
        await fetchUserPosition(address);
      }
      
    } catch (error: any) {
      console.error('🔍 Ethers Debug: Withdrawal failed:', error);
      setTxStatus('failed');
      
      // Detailed error handling
      const errorMessage = (error as Error)?.message || 'Unknown error';
      if (errorMessage.includes('User rejected')) {
        toast.error('Transaction rejected by user');
      } else if (errorMessage.includes('insufficient funds')) {
        toast.error('Insufficient funds for transaction');
      } else if (errorMessage.includes('execution reverted')) {
        toast.error('Withdrawal failed - check contract state');
      } else if (errorMessage.includes('network')) {
        toast.error('Network connection failed');
      } else {
        toast.error(`Withdrawal failed: ${errorMessage}`);
      }
    } finally {
      setIsWithdrawing(false);
      console.log('🔍 Ethers Debug: ===== WITHDRAWAL END =====');
    }
  };

  const handleWithdrawalTypeChange = (type: WithdrawalType) => {
    setWithdrawalType(type);
    if (type === 'full') {
      setWithdrawalAmount(userPosition.currentValue);
    } else {
      setWithdrawalAmount('');
    }
  };

  const hasPosition = userPosition && parseFloat(userPosition.currentValue) > 0;
  const totalReturns = parseFloat(userPosition.totalReturns);
  const currentValue = parseFloat(userPosition.currentValue);
  const principal = parseFloat(userPosition.principal);
  
  // Debug logging
  console.log('🔍 Withdrawal Debug: hasPosition check:', {
    userPosition,
    currentValue,
    hasPosition
  });

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
            Withdraw Funds
          </h1>
          <p className="text-gray-300">
            Withdraw your USDC tokens and any earned yields from NeuroWealth
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Withdrawal Form */}
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
                  <p className="text-gray-300 mb-4">Connect your wallet to withdraw funds</p>
                  <GradientButton onClick={connectWallet} className="px-6 py-2">
                    Connect Wallet
                  </GradientButton>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-400/10 border border-green-400/20 rounded-xl">
                    <div>
                      <div className="text-green-400 font-semibold">✅ Wallet Connected</div>
                      <div className="text-gray-300 text-sm">
                        {address ? `${address.slice(0,6)}...${address.slice(-4)}` : 'Unknown address'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">{usdcBalance} USDC</div>
                      <div className="text-gray-400 text-sm">Wallet Balance</div>
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

            {/* Position Overview */}
            {isConnected && (
              <GlowCard className="transition-transform duration-200 hover:scale-[1.02] hover:shadow-glow-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-space-grotesk text-lg font-bold text-white tracking-tight">Your Position</h3>
                  <button
                    onClick={() => address && fetchUserPosition(address)}
                    className="flex items-center text-gray-400 hover:text-green-400 transition-colors"
                    title="Refresh position"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Refresh
                  </button>
                </div>

                {hasPosition ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-400/10 border border-blue-400/20 rounded-xl">
                        <div className="text-blue-400 font-semibold">Current Value</div>
                        <div className="text-white text-xl font-bold">{currentValue.toFixed(4)} USDC</div>
                      </div>
                      <div className="p-4 bg-green-400/10 border border-green-400/20 rounded-xl">
                        <div className="text-green-400 font-semibold">Total Returns</div>
                        <div className="text-white text-xl font-bold">{totalReturns.toFixed(4)} USDC</div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-gray-800/50 rounded-xl">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Principal Invested:</span>
                        <span className="text-white">{principal.toFixed(4)} USDC</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-400">User Tier:</span>
                        <span className="text-white">Tier {userPosition.userTier}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-400">Return Rate:</span>
                        <span className={`font-semibold ${totalReturns > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                          {principal > 0 ? ((totalReturns / principal) * 100).toFixed(2) : '0.00'}%
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <TrendingDown className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-300 mb-2">No Active Position</p>
                    <p className="text-gray-400 text-sm">You don&apos;t have any funds deposited in NeuroWealth</p>
                    <Link href="/deposit" className="text-green-400 hover:text-green-300 text-sm mt-2 inline-block">
                      Make a deposit first →
                    </Link>
                  </div>
                )}
              </GlowCard>
            )}

            {/* Withdrawal Form */}
            {isConnected && hasPosition && (
              <GlowCard className="transition-transform duration-200 hover:scale-[1.02] hover:shadow-glow-card">
                <h3 className="font-space-grotesk text-lg font-bold text-white mb-4">Withdrawal Options</h3>
                
                <div className="space-y-4">
                  {/* Withdrawal Type Selection */}
                  <div className="space-y-3">
                    <label className="text-gray-300 font-medium">Withdrawal Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleWithdrawalTypeChange('partial')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          withdrawalType === 'partial'
                            ? 'border-blue-400 bg-blue-400/20 ring-2 ring-blue-400/40'
                            : 'border-gray-600 bg-gray-700/50 hover:border-blue-400/50'
                        }`}
                      >
                        <div className="text-white font-semibold">Partial</div>
                        <div className="text-gray-400 text-sm">Withdraw specific amount</div>
                      </button>
                      
                      <button
                        onClick={() => handleWithdrawalTypeChange('full')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          withdrawalType === 'full'
                            ? 'border-green-400 bg-green-400/20 ring-2 ring-green-400/40'
                            : 'border-gray-600 bg-gray-700/50 hover:border-green-400/50'
                        }`}
                      >
                        <div className="text-white font-semibold">Full</div>
                        <div className="text-gray-400 text-sm">Withdraw everything</div>
                      </button>
                    </div>
                  </div>

                  {/* Amount Input */}
                  {withdrawalType === 'partial' && (
                    <div>
                      <label className="text-gray-300 font-medium mb-2 block">Withdrawal Amount</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={withdrawalAmount}
                          onChange={(e) => setWithdrawalAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-green-400"
                          disabled={withdrawalType !== 'partial'}
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                          USDC
                        </div>
                      </div>
                      
                      <div className="flex justify-between mt-2 text-sm">
                        <span className="text-gray-400">
                          Available: {currentValue.toFixed(4)} USDC
                        </span>
                        <button 
                          onClick={() => setWithdrawalAmount(currentValue.toString())}
                          className="text-green-400 hover:text-white transition-colors"
                          disabled={withdrawalType !== 'partial'}
                        >
                          Max
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Withdrawal Summary */}
                  <div className="p-4 bg-gray-800/50 rounded-xl">
                    <h4 className="text-white font-semibold mb-2">Withdrawal Summary</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Amount:</span>
                        <span className="text-white">
                          {withdrawalType === 'full' ? currentValue.toFixed(4) : parseFloat(withdrawalAmount || '0').toFixed(4)} USDC
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Performance Fee:</span>
                        <span className="text-gray-300">0.5% on profits only</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">You&apos;ll Receive:</span>
                        <span className="text-green-400 font-semibold">
                          {withdrawalType === 'full' 
                            ? currentValue.toFixed(4) 
                            : parseFloat(withdrawalAmount || '0').toFixed(4)
                          } USDC
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
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
                      {txStatus === 'pending' ? 'Withdrawal pending...' :
                       txStatus === 'confirmed' ? 'Withdrawal confirmed!' :
                       'Withdrawal failed'}
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

            {/* Withdrawal Button */}
            {isConnected && hasPosition && (
              <GradientButton
                onClick={handleWithdrawal}
                disabled={!isConnected || !isCorrectNetwork || isWithdrawing || txStatus === 'pending' || (withdrawalType === 'partial' && !withdrawalAmount)}
                className="w-full font-space-grotesk text-lg py-4 shadow-glow-card transition-transform hover:scale-105"
                size="lg"
              >
                {isWithdrawing ? (
                  <div className="flex items-center justify-center gap-2">
                    <LoadingSpinner size="sm" />
                    Processing Withdrawal...
                  </div>
                ) : 
                 !isConnected ? 'Connect Wallet First' :
                 !isCorrectNetwork ? 'Switch to Testnet' :
                 withdrawalType === 'full' ? 'Withdraw All Funds' :
                 'Withdraw Funds'}
              </GradientButton>
            )}
          </div>

          {/* Info Sidebar */}
          <div className="space-y-6">
            <GlowCard className="transition-transform duration-200 hover:scale-[1.02] hover:shadow-glow-card">
              <h3 className="font-space-grotesk text-lg font-bold text-white mb-4 flex items-center tracking-tight">
                <TrendingDown className="w-6 h-6 mr-2 text-red-400" />
                How Withdrawals Work
              </h3>
              
              <div className="space-y-4 text-sm text-gray-300">
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Withdraw partial or full amounts from your position</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Performance fees only apply to profits (0.5%)</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Funds are withdrawn from all active protocols</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p>USDC tokens are returned to your wallet</p>
                </div>
              </div>
            </GlowCard>

            <GlowCard className="transition-transform duration-200 hover:scale-[1.02] hover:shadow-glow-card">
              <h4 className="font-space-grotesk text-base font-bold text-white mb-3 tracking-tight">Performance Fees</h4>
              <div className="space-y-3 text-sm text-gray-300">
                <div className="p-3 bg-green-400/10 border border-green-400/20 rounded-lg">
                  <div className="text-green-400 font-semibold">0.5% on Profits Only</div>
                  <div className="text-xs text-gray-400 mt-1">
                    You only pay fees on gains, never on your principal
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  <strong>Example:</strong> If you deposited 100 USDC and it&apos;s now worth 110 USDC, 
                  you only pay 0.5% on the 10 USDC profit = 0.05 USDC fee.
                </div>
              </div>
            </GlowCard>

            <GlowCard className="transition-transform duration-200 hover:scale-[1.02] hover:shadow-glow-card">
              <h4 className="font-space-grotesk text-base font-bold text-white mb-3 tracking-tight">Quick Actions</h4>
              <div className="space-y-2">
                <Link 
                  href="/deposit-ethers"
                  className="block p-3 rounded-lg bg-blue-400/10 border border-blue-400/20 hover:bg-blue-400/20 transition-colors"
                >
                  <div className="font-medium text-blue-400">Make Another Deposit</div>
                  <div className="text-sm text-gray-400">Add more funds to your position</div>
                </Link>
                <Link 
                  href="/dashboard"
                  className="block p-3 rounded-lg bg-green-400/10 border border-green-400/20 hover:bg-green-400/20 transition-colors"
                >
                  <div className="font-medium text-green-400">View Dashboard</div>
                  <div className="text-sm text-gray-400">Track your portfolio performance</div>
                </Link>
              </div>
            </GlowCard>
          </div>
        </div>
      </div>
    </div>
  );
}
