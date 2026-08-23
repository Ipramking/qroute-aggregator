const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("qroute-aggregator Contracts", function () {
  let owner;
  let feeTo;
  let user;
  let token0;
  let token1;
  let pair;
  let router;

  beforeEach(async function () {
    [owner, feeTo, user] = await ethers.getSigners();

    // Deploy Mock Tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token0 = await MockERC20.deploy("Token 0", "TK0");
    token1 = await MockERC20.deploy("Token 1", "TK1");

    await token0.waitForDeployment();
    await token1.waitForDeployment();

    // Deploy DEX Pair
    const QuaiDEXPair = await ethers.getContractFactory("QuaiDEXPair");
    pair = await QuaiDEXPair.deploy(await token0.getAddress(), await token1.getAddress());
    await pair.waitForDeployment();

    // Deploy Router
    const CrossShardRouter = await ethers.getContractFactory("CrossShardRouter");
    router = await CrossShardRouter.deploy(feeTo.address);
    await router.waitForDeployment();

    // Set up initial liquidity: 10,000 TK0 and 20,000 TK1
    const amount0 = ethers.parseEther("10000");
    const amount1 = ethers.parseEther("20000");

    await token0.mint(await pair.getAddress(), amount0);
    await token1.mint(await pair.getAddress(), amount1);
    await pair.mint(owner.address);
  });

  it("should deploy correctly and hold correct tokens", async function () {
    expect(await pair.token0()).to.equal(await token0.getAddress());
    expect(await pair.token1()).to.equal(await token1.getAddress());
  });

  it("should calculate correct out amount with 0.1% protocol fee and 0.3% pool fee", async function () {
    const amountIn = ethers.parseEther("100"); // 100 TK0
    
    // Manual calculation details:
    // Protocol fee = 0.1% -> amountIn * 999 / 1000 = 99.9 TK0
    // Remaining input for DEX = 99.9 TK0
    // DEX has pool fee = 0.3% (99.9 * 997 / 1000) = 99.6003 TK0
    // ReserveIn = 10000 TK0, ReserveOut = 20000 TK1
    // expectedOutput = (99.6003 * 20000) / (10000 + 99.6003) = 197.2359... TK1
    
    const amountOut = await router.getAmountOut(
      ethers.parseEther("99.9"), // amount after protocol fee
      ethers.parseEther("10000"),
      ethers.parseEther("20000")
    );
    expect(amountOut).to.be.gt(ethers.parseEther("197"));
    expect(amountOut).to.be.lt(ethers.parseEther("198"));
  });

  it("should execute a local swap successfully", async function () {
    const amountIn = ethers.parseEther("100"); // 100 TK0
    
    // Mint tokens to user and approve router
    await token0.mint(user.address, amountIn);
    await token0.connect(user).approve(await router.getAddress(), amountIn);

    // Swap TK0 for TK1
    await router.connect(user).localSwap(
      await token0.getAddress(),
      await token1.getAddress(),
      await pair.getAddress(),
      amountIn,
      0, // minAmountOut
      user.address
    );

    // Verify user balance of TK1 increased
    const userBalance1 = await token1.balanceOf(user.address);
    expect(userBalance1).to.be.gt(ethers.parseEther("197"));

    // Verify protocol fee went to feeTo
    const feeBalance = await token0.balanceOf(feeTo.address);
    expect(feeBalance).to.equal(ethers.parseEther("0.1")); // 0.1% of 100
  });

  it("should execute a cross-shard swap simulation successfully", async function () {
    const amountIn = ethers.parseEther("100");
    await token0.mint(user.address, amountIn);
    await token0.connect(user).approve(await router.getAddress(), amountIn);

    // Swap and transfer output cross-shard (destination shard simulation)
    // We send final swapped TK1 to user address simulating cross-shard dispatch
    await router.connect(user).swapAndTransferCrossShard(
      await token0.getAddress(),
      await token1.getAddress(),
      await pair.getAddress(),
      amountIn,
      0,
      user.address,
      2 // destination shard ID
    );

    const userBalance1 = await token1.balanceOf(user.address);
    expect(userBalance1).to.be.gt(ethers.parseEther("197"));
  });

  it("should execute onTokenBridgeReceived callback simulation successfully", async function () {
    const amountIn = ethers.parseEther("100");
    
    // Transfer tokens directly to the router to simulate cross-shard arrival
    await token0.mint(await router.getAddress(), amountIn);

    // Trigger the callback to execute swap and send output to user
    await router.onTokenBridgeReceived(
      await token0.getAddress(),
      await token1.getAddress(),
      await pair.getAddress(),
      amountIn,
      0,
      user.address
    );

    const userBalance1 = await token1.balanceOf(user.address);
    expect(userBalance1).to.be.gt(ethers.parseEther("197"));
  });
});
