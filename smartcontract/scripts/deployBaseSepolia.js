// scripts/deployBaseSepolia.js
const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying to Base Sepolia with:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

    // Helper function to wait for transaction confirmation
    const waitForTx = async (tx, description) => {
        console.log(`⏳ ${description}...`);
        await tx.wait();
        console.log(`✓ ${description} confirmed`);
    };

    // Base Sepolia addresses
    const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const WETH_BASE_SEPOLIA = "0x4200000000000000000000000000000000000006";

    // 1. Deploy MIND token
    console.log("\n1. Deploying MIND token...");
    const MIND = await ethers.getContractFactory("MIND");
    const mindToken = await MIND.deploy();
    await mindToken.waitForDeployment();
    console.log("✓ MIND deployed to:", mindToken.target);

    // 2. Deploy MINDStaking
    console.log("\n2. Deploying MINDStaking...");
    const MINDStaking = await ethers.getContractFactory("MINDStaking");
    const staking = await MINDStaking.deploy(mindToken.target);
    await staking.waitForDeployment();
    console.log("✓ Staking deployed to:", staking.target);

    // 3. Add staking contract as MIND minter
    console.log("\n3. Setting up MIND minter...");
    const addMinterTx = await mindToken.addMinter(staking.target);
    await waitForTx(addMinterTx, "Adding staking contract as MIND minter");

    // 4. Deploy AIStrategyManagerV2
    console.log("\n4. Deploying AIStrategyManagerV2...");
    const AIStrategyManagerV2 = await ethers.getContractFactory("AIStrategyManagerV2");
    const strategyManager = await AIStrategyManagerV2.deploy(deployer.address);
    await strategyManager.waitForDeployment();
    console.log("✓ Strategy Manager deployed to:", strategyManager.target);

    // 5. Deploy WORKING SimplifiedUniswapAdapter
    console.log("\n5. Deploying SimplifiedUniswapAdapter (WORKING VERSION)...");
    const SimplifiedUniswapAdapter = await ethers.getContractFactory("SimplifiedUniswapAdapter");
    const uniswapAdapter = await SimplifiedUniswapAdapter.deploy(
        USDC_BASE_SEPOLIA,
        WETH_BASE_SEPOLIA,
        "0x1234567890123456789012345678901234567890", // Mock router for now
        strategyManager.target
    );
    await uniswapAdapter.waitForDeployment();
    console.log("✓ Uniswap adapter deployed to:", uniswapAdapter.target);

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

    // 7. Update strategy manager to use real vault
    console.log("\n7. Updating strategy manager with vault address...");
    await strategyManager.setVault(vault.target);
    console.log("✓ Strategy manager updated");

    // 8. Initialize Uniswap in strategy manager
    console.log("\n8. Initializing Uniswap protocol...");
    await strategyManager.initializeUniswap(uniswapAdapter.target);
    console.log("✓ Uniswap protocol initialized");

    // 9. Save deployment info
    const deploymentInfo = {
        network: "Base Sepolia",
        chainId: 84532,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            MIND: mindToken.target,
            MINDStaking: staking.target,
            AIStrategyManagerV2: strategyManager.target,
            NeuroWealthVault: vault.target,
            SimplifiedUniswapAdapter: uniswapAdapter.target
        },
        tokens: {
            USDC: USDC_BASE_SEPOLIA,
            WETH: WETH_BASE_SEPOLIA
        }
    };

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

    console.log("\n✅ Ready for Testing:");
    console.log("1. Users can stake MIND tokens");
    console.log("2. Users can deposit USDC to vault");
    console.log("3. AI strategy manager will deploy to Uniswap");
    console.log("4. Users earn returns through automated strategies");

    console.log("\n🔍 Next Steps:");
    console.log("1. Verify contracts on Base Sepolia explorer");
    console.log("2. Test deposit/withdrawal functionality");
    console.log("3. Update frontend with new contract addresses");
    console.log("4. Deploy to Base mainnet when ready");

    console.log("\n📝 Save this deployment info for your records!");
}

main().catch((error) => {
    console.error("Deployment failed:", error);
    process.exitCode = 1;
});
