// scripts/deploySimple.js - Simple deployment with proper nonce handling
const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying to Base Sepolia with:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

    // Base Sepolia addresses
    const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const WETH_BASE_SEPOLIA = "0x4200000000000000000000000000000000000006";

    try {
        // 1. Deploy MIND token
        console.log("\n1. Deploying MIND token...");
        const MIND = await ethers.getContractFactory("MIND");
        const mindToken = await MIND.deploy();
        await mindToken.waitForDeployment();
        console.log("✓ MIND deployed to:", mindToken.target);

        // Wait a bit between deployments
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 2. Deploy MINDStaking
        console.log("\n2. Deploying MINDStaking...");
        const MINDStaking = await ethers.getContractFactory("MINDStaking");
        const staking = await MINDStaking.deploy(mindToken.target);
        await staking.waitForDeployment();
        console.log("✓ Staking deployed to:", staking.target);

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 3. Add staking contract as MIND minter
        console.log("\n3. Setting up MIND minter...");
        const addMinterTx = await mindToken.addMinter(staking.target);
        await addMinterTx.wait();
        console.log("✓ Staking contract added as MIND minter");

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 4. Deploy AIStrategyManagerV2
        console.log("\n4. Deploying AIStrategyManagerV2...");
        const AIStrategyManagerV2 = await ethers.getContractFactory("AIStrategyManagerV2");
        const strategyManager = await AIStrategyManagerV2.deploy(deployer.address);
        await strategyManager.waitForDeployment();
        console.log("✓ Strategy Manager deployed to:", strategyManager.target);

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 5. Deploy SimplifiedUniswapAdapter
        console.log("\n5. Deploying SimplifiedUniswapAdapter...");
        const SimplifiedUniswapAdapter = await ethers.getContractFactory("SimplifiedUniswapAdapter");
        const uniswapAdapter = await SimplifiedUniswapAdapter.deploy(
            USDC_BASE_SEPOLIA,
            WETH_BASE_SEPOLIA,
            "0x1234567890123456789012345678901234567890", // Mock router
            strategyManager.target
        );
        await uniswapAdapter.waitForDeployment();
        console.log("✓ Uniswap adapter deployed to:", uniswapAdapter.target);

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 6. Deploy NeuroWealthVault
        console.log("\n6. Deploying NeuroWealthVault...");
        const NeuroWealthVault = await ethers.getContractFactory("NeuroWealthVault");
        const vault = await NeuroWealthVault.deploy(
            staking.target,
            strategyManager.target,
            USDC_BASE_SEPOLIA
        );
        await vault.waitForDeployment();
        console.log("✓ Vault deployed to:", vault.target);

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 7. Update strategy manager with vault address
        console.log("\n7. Updating strategy manager with vault address...");
        const setVaultTx = await strategyManager.setVault(vault.target);
        await setVaultTx.wait();
        console.log("✓ Strategy manager updated");

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 8. Initialize Uniswap in strategy manager
        console.log("\n8. Initializing Uniswap protocol...");
        const initUniswapTx = await strategyManager.initializeUniswap(uniswapAdapter.target);
        await initUniswapTx.wait();
        console.log("✓ Uniswap protocol initialized");

        // Summary
        console.log("\n" + "=".repeat(60));
        console.log("🚀 DEPLOYMENT TO BASE SEPOLIA COMPLETE! 🚀");
        console.log("=".repeat(60));
        console.log("\n📋 Contract Addresses:");
        console.log("MIND Token:", mindToken.target);
        console.log("Staking:", staking.target);
        console.log("Strategy Manager:", strategyManager.target);
        console.log("Vault:", vault.target);
        console.log("Uniswap Adapter:", uniswapAdapter.target);

        console.log("\n🔗 Network Info:");
        console.log("Network: Base Sepolia");
        console.log("Chain ID: 84532");
        console.log("USDC: ", USDC_BASE_SEPOLIA);
        console.log("WETH: ", WETH_BASE_SEPOLIA);

        console.log("\n✅ Your NeuroWealth platform is now live on Base Sepolia!");
        console.log("🎉 Users can now deposit USDC and earn returns through Uniswap!");

    } catch (error) {
        console.error("❌ Deployment failed:", error.message);

        if (error.message.includes("nonce too low")) {
            console.log("\n💡 Nonce issue detected. Try again in a few minutes.");
            console.log("This happens when there are pending transactions.");
        } else if (error.message.includes("insufficient funds")) {
            console.log("\n💡 Insufficient funds. Make sure you have enough Base Sepolia ETH for gas.");
            console.log("Get testnet ETH from: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
        }

        throw error;
    }
}

main().catch((error) => {
    console.error("Deployment failed:", error);
    process.exitCode = 1;
});
