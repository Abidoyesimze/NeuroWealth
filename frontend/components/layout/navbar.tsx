'use client';

import { useAppKitAccount, useAppKit, useAppKitNetwork } from '@reown/appkit/react';
import Link from 'next/link';
import { TrendingUp, Zap } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function Navbar() {
  const pathname = usePathname();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { chainId } = useAppKitNetwork();

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/deposit', label: 'Deposit' },
    { href: '/withdraw', label: 'Withdraw' },
    { href: '/premium', label: (<><Zap className="w-4 h-4" /><span>Premium</span></>) },
  ];

  const formatAddress = (addr: string | undefined) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="p-2 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg group-hover:scale-110 transition-transform shadow-glow">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <span className="font-heading font-bold text-xl text-white tracking-tight">
              NeuroWealth
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-8 relative">
            {navLinks.map(({ href, label }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={
                    `relative font-medium transition-colors px-1 py-0.5 flex items-center gap-1 ` +
                    (isActive
                      ? 'text-white'
                      : 'text-gray-400 hover:text-white')
                  }
                >
                  {label}
                  {isActive && (
                    <span className="absolute left-0 right-0 -bottom-1 h-1 rounded-full bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 animate-gradient-x" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-4">
            {!isConnected ? (
              <button
                onClick={() => open()}
                type="button"
                className="px-6 py-2 bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-green-500/30 transition-all duration-200 hover:scale-105"
              >
                Connect Wallet
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => open({ view: 'Networks' })}
                  className="px-3 py-2 bg-slate-800/50 hover:bg-slate-800 rounded-xl text-sm font-medium text-gray-300 hover:text-white border border-slate-700 transition-colors"
                  type="button"
                >
                  Base Sepolia
                </button>
                <button
                  onClick={() => open()}
                  type="button"
                  className="px-4 py-2 bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-green-500/30 transition-all duration-200"
                >
                  {formatAddress(address)}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
