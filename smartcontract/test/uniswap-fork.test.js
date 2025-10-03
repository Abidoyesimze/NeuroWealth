const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("Uniswap V3 Integration Test", function () {
  it("tests Uniswap integration with Base mainnet fork", async function () {
    const [deployer] = await ethers.getSigners();

    // Base Mainnet addresses
    const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    const WETH_BASE_MAINNET = "0x4200000000000000000000000000000000000006";

    // Deploy MIND token
    const MIND = await ethers.getContractFactory("MIND");
    const mindToken = await MIND.deploy();
    await mindToken.waitForDeployment();

    // Deploy staking contract
    const MINDStaking = await ethers.getContractFactory("MINDStaking");
    const staking = await MINDStaking.deploy(mindToken.target);
    await staking.waitForDeployment();

    await mindToken.addMinter(staking.target);

    // Deploy AI Strategy Manager
    const AIStrategyManagerV2 = await ethers.getContractFactory("AIStrategyManagerV2");
    const strategyManager = await AIStrategyManagerV2.deploy(deployer.address);
    await strategyManager.waitForDeployment();

    // Deploy Simplified Uniswap Adapter
    const SimplifiedUniswapAdapter = await ethers.getContractFactory("SimplifiedUniswapAdapter");
    const uniswapAdapter = await SimplifiedUniswapAdapter.deploy(
      USDC_BASE_MAINNET,
      WETH_BASE_MAINNET,
      "0x1234567890123456789012345678901234567890", // Mock router
      strategyManager.target
    );
    await uniswapAdapter.waitForDeployment();

    // Deploy vault WITH strategy manager
    const NeuroWealthVault = await ethers.getContractFactory("NeuroWealthVault");
    const vault = await NeuroWealthVault.deploy(
      staking.target,
      strategyManager.target,
      USDC_BASE_MAINNET
    );
    await vault.waitForDeployment();

    // Update strategy manager with vault address
    await strategyManager.setVault(vault.target);

    // Initialize Uniswap in strategy manager
    await strategyManager.initializeUniswap(uniswapAdapter.target);

    // Get USDC from whale
    const USDC_WHALE = "0x20FE51A9229EEf2cF8Ad9E89d91CAb9312cF3b7A";
    await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
    const whale = await ethers.getSigner(USDC_WHALE);

    const usdc = await ethers.getContractAt("IERC20", USDC_BASE_MAINNET);
    await usdc.connect(whale).transfer(deployer.address, ethers.parseUnits("10000", 6));

    // Stake MIND
    await mindToken.approve(staking.target, ethers.parseEther("100"));
    await staking.stake(ethers.parseEther("100"));

    // Test deposit
    await usdc.approve(vault.target, ethers.parseUnits("1000", 6));
    await vault.deposit(ethers.parseUnits("1000", 6));

    // Verify position
    const position = await vault.getUserPosition(deployer.address);
    const uniswapBalance = await uniswapAdapter.getUserBalance(deployer.address);

    // Assertions
    expect(position.principal).to.equal(ethers.parseUnits("1000", 6));
    expect(position.currentValue).to.equal(ethers.parseUnits("1000", 6));
    expect(uniswapBalance).to.equal(ethers.parseUnits("1000", 6));

    console.log("✅ Uniswap integration test passed!");
    console.log("✅ Principal:", ethers.formatUnits(position.principal, 6), "USDC");
    console.log("✅ Current Value:", ethers.formatUnits(position.currentValue, 6), "USDC");
    console.log("✅ Uniswap Balance:", ethers.formatUnits(uniswapBalance, 6), "USDC");
  });
});
