// scripts/verifyContracts.js
const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Verifying NeuroWealth contracts on Base Sepolia...\n");

    // Your deployed contract addresses
    const contracts = {
        MIND: {
            address: "0x5908225583f89A3060D5f9eecbc0288fcEc2c512",
            constructorArgs: []
        },
        MINDStaking: {
            address: "0xc21a9314D539Fc3849EFE42b408F3985c3D07846",
            constructorArgs: ["0x5908225583f89A3060D5f9eecbc0288fcEc2c512"] // MIND token address
        },
        AIStrategyManagerV2: {
            address: "0xd12887c24Ad81A6e0b428093ea8f9bA86C04F043",
            constructorArgs: ["0x95e1CF9174AbD55E47b9EDa1b3f0F2ba0f4369a0"] // Deployer address
        },
        SimplifiedUniswapAdapter: {
            address: "0xE186CD2BF3Ff533F71a39e56367B5cec9276473C",
            constructorArgs: [
                "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC
                "0x4200000000000000000000000000000000000006", // WETH
                "0x1234567890123456789012345678901234567890", // Mock router
                "0xd12887c24Ad81A6e0b428093ea8f9bA86C04F043"  // Strategy Manager
            ]
        },
        NeuroWealthVault: {
            address: "0x92D5C55F8226a3742D89Ea4582C04195Ab0975F0",
            constructorArgs: [
                "0xc21a9314D539Fc3849EFE42b408F3985c3D07846", // Staking
                "0xd12887c24Ad81A6e0b428093ea8f9bA86C04F043", // Strategy Manager
                "0x036CbD53842c5426634e7929541eC2318f3dCF7e"  // USDC
            ]
        }
    };

    try {
        // Verify MIND token first (simplest)
        console.log("1. Verifying MIND Token...");
        await hre.run("verify:verify", {
            address: contracts.MIND.address,
            constructorArguments: contracts.MIND.constructorArgs,
        });
        console.log("✅ MIND Token verified!");

        // Wait a bit between verifications
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Verify MINDStaking
        console.log("\n2. Verifying MINDStaking...");
        await hre.run("verify:verify", {
            address: contracts.MINDStaking.address,
            constructorArguments: contracts.MINDStaking.constructorArgs,
        });
        console.log("✅ MINDStaking verified!");

        await new Promise(resolve => setTimeout(resolve, 5000));

        // Verify AIStrategyManagerV2
        console.log("\n3. Verifying AIStrategyManagerV2...");
        await hre.run("verify:verify", {
            address: contracts.AIStrategyManagerV2.address,
            constructorArguments: contracts.AIStrategyManagerV2.constructorArgs,
        });
        console.log("✅ AIStrategyManagerV2 verified!");

        await new Promise(resolve => setTimeout(resolve, 5000));

        // Verify SimplifiedUniswapAdapter
        console.log("\n4. Verifying SimplifiedUniswapAdapter...");
        await hre.run("verify:verify", {
            address: contracts.SimplifiedUniswapAdapter.address,
            constructorArguments: contracts.SimplifiedUniswapAdapter.constructorArgs,
        });
        console.log("✅ SimplifiedUniswapAdapter verified!");

        await new Promise(resolve => setTimeout(resolve, 5000));

        // Verify NeuroWealthVault
        console.log("\n5. Verifying NeuroWealthVault...");
        await hre.run("verify:verify", {
            address: contracts.NeuroWealthVault.address,
            constructorArguments: contracts.NeuroWealthVault.constructorArgs,
        });
        console.log("✅ NeuroWealthVault verified!");

        console.log("\n" + "=".repeat(60));
        console.log("🎉 ALL CONTRACTS VERIFIED SUCCESSFULLY! 🎉");
        console.log("=".repeat(60));

        console.log("\n📋 Verified Contract Links:");
        console.log("MIND Token: https://sepolia.basescan.org/address/" + contracts.MIND.address);
        console.log("Staking: https://sepolia.basescan.org/address/" + contracts.MINDStaking.address);
        console.log("Strategy Manager: https://sepolia.basescan.org/address/" + contracts.AIStrategyManagerV2.address);
        console.log("Uniswap Adapter: https://sepolia.basescan.org/address/" + contracts.SimplifiedUniswapAdapter.address);
        console.log("Vault: https://sepolia.basescan.org/address/" + contracts.NeuroWealthVault.address);

        console.log("\n✅ Your contracts are now transparent and trustworthy!");
        console.log("🔍 Users can now read your source code on BaseScan");

    } catch (error) {
        console.error("❌ Verification failed:", error.message);

        if (error.message.includes("already verified")) {
            console.log("✅ Contract is already verified!");
        } else if (error.message.includes("constructor arguments")) {
            console.log("💡 Constructor arguments might be incorrect. Check the deployment script.");
        } else {
            console.log("💡 Try running verification for individual contracts:");
            console.log("npx hardhat verify --network baseSepolia <contract-address> <constructor-args>");
        }
    }
}

main().catch((error) => {
    console.error("Verification failed:", error);
    process.exitCode = 1;
});
