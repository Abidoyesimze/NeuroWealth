import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { baseSepolia } from 'viem/chains'

// Get the project ID from environment variables
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!

if (!projectId) {
  throw new Error('Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID')
}

// Create wagmi adapter
export const wagmiAdapter = new WagmiAdapter({
  ssr: false,
  networks: [baseSepolia],
  projectId,
})

// Get wagmi config from the adapter
export const wagmiConfig = wagmiAdapter.wagmiConfig

// Create AppKit instance
export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: [baseSepolia],
  projectId,
  metadata: {
    name: 'NeuroWealth',
    description: 'AI-Powered DeFi Investment Platform',
    url: 'https://neurowealth.com',
    icons: ['https://neurowealth.com/logo.png'],
  },
  features: {
    analytics: false, // Disable analytics for now
  },
})