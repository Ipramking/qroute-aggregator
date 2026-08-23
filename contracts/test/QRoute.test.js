const { expect } = require("chai");
const { ethers } = require("hardhat");

const E18 = 10n ** 18n;
const FAR_DEADLINE = 2_000_000_000; // year 2033
const ZERO = "0x0000000000000000000000000000000000000000";

describe("qroute hardened contracts", function () {
  let deployer, user, feeTo, relayer, other;
  let qi, usdc, token0Addr, token1Addr, pair, registry, router;

  beforeEach(async function () {
    [deployer, user, feeTo, relayer, other] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("TestToken");
    qi = await Token.deploy("Quai Test QI", "QI");
    usdc = await Token.deploy("Quai Test USDC", "USDC");

    const qiAddr = await qi.getAddress();
    const usdcAddr = await usdc.getAddress();
    // Sort so token0 < token1 (matches reserve0/reserve1 semantics).
    [token0Addr, token1Addr] =
      BigInt(qiAddr) < BigInt(usdcAddr) ? [qiAddr, usdcAddr] : [usdcAddr, qiAddr];

    const Pair = await ethers.getContractFactory("QRoutePair");
    pair = await Pair.deploy(token0Addr, token1Addr);

    const Registry = await ethers.getContractFactory("QRouteRegistry");
    registry = await Registry.deploy();
    await registry.registerPair(qiAddr, usdcAddr, await pair.getAddress());

    const Router = await ethers.getContractFactory("QRouteRouter");
    router = await Router.deploy(await registry.getAddress(), feeTo.address);

    // Seed liquidity: 100k / 100k.
    const seed = 100_000n * E18;
    await qi.mint(deployer.address, seed);
    await usdc.mint(deployer.address, seed);
    await qi.transfer(await pair.getAddress(), seed);
    await usdc.transfer(await pair.getAddress(), seed);
    await pair.mint(deployer.address);
  });

  describe("QRoutePair — LP accounting (C1)", function () {
    it("mints proportional LP shares and locks MINIMUM_LIQUIDITY", async function () {
      const total = await pair.totalSupply();
      // sqrt(100k*100k)e18 = 100k e18; deployer holds that minus the locked 1000.
      expect(total).to.equal(100_000n * E18);
      expect(await pair.balanceOf(deployer.address)).to.equal(100_000n * E18 - 1000n);
      expect(await pair.balanceOf("0x000000000000000000000000000000000000dEaD")).to.equal(1000n);
    });

    it("reverts burn when caller has transferred no LP (cannot drain the pool)", async function () {
      // `other` has no LP; calling burn without depositing LP redeems nothing.
      await expect(pair.connect(other).burn(other.address)).to.be.revertedWith(
        "QRoute: INSUFFICIENT_LIQUIDITY_BURNED"
      );
    });

    it("burns proportionally to LP share", async function () {
      const lp = await pair.balanceOf(deployer.address);
      await pair.transfer(await pair.getAddress(), lp);
      await pair.burn(deployer.address);
      // Deployer recovers ~all seeded tokens (minus dust locked with MINIMUM_LIQUIDITY).
      const back0 = await (token0Addr === (await qi.getAddress()) ? qi : usdc).balanceOf(
        deployer.address
      );
      expect(back0).to.be.greaterThan(99_999n * E18);
    });
  });

  describe("QRouteRouter — local swap", function () {
    it("executes a real swap, charges 0.1% protocol fee, respects minAmountOut", async function () {
      const amountIn = 1000n * E18;
      await qi.mint(user.address, amountIn);
      await qi.connect(user).approve(await router.getAddress(), amountIn);

      const usdcBefore = await usdc.balanceOf(user.address);
      await router
        .connect(user)
        .localSwap(await qi.getAddress(), await usdc.getAddress(), amountIn, 0, user.address, FAR_DEADLINE);

      const usdcAfter = await usdc.balanceOf(user.address);
      expect(usdcAfter).to.be.greaterThan(usdcBefore);

      // 0.1% protocol fee on QI in went to feeTo.
      expect(await qi.balanceOf(feeTo.address)).to.equal(amountIn / 1000n);
    });

    it("reverts on slippage (minAmountOut too high)", async function () {
      const amountIn = 1000n * E18;
      await qi.mint(user.address, amountIn);
      await qi.connect(user).approve(await router.getAddress(), amountIn);
      await expect(
        router
          .connect(user)
          .localSwap(await qi.getAddress(), await usdc.getAddress(), amountIn, 10_000n * E18, user.address, FAR_DEADLINE)
      ).to.be.revertedWith("QRoute: INSUFFICIENT_OUTPUT_AMOUNT");
    });

    it("reverts on expired deadline (H5)", async function () {
      const amountIn = 1000n * E18;
      await qi.mint(user.address, amountIn);
      await qi.connect(user).approve(await router.getAddress(), amountIn);
      await expect(
        router
          .connect(user)
          .localSwap(await qi.getAddress(), await usdc.getAddress(), amountIn, 0, user.address, 1)
      ).to.be.revertedWith("QRoute: EXPIRED");
    });

    it("reverts for an unregistered pair (C3)", async function () {
      const Token = await ethers.getContractFactory("TestToken");
      const rogue = await Token.deploy("Rogue", "RGE");
      await rogue.mint(user.address, 1000n * E18);
      await rogue.connect(user).approve(await router.getAddress(), 1000n * E18);
      await expect(
        router
          .connect(user)
          .localSwap(await rogue.getAddress(), await usdc.getAddress(), 1000n * E18, 0, user.address, FAR_DEADLINE)
      ).to.be.revertedWith("QRoute: NO_PAIR");
    });
  });

  describe("QRouteRouter — liquidity", function () {
    it("adds liquidity atomically and mints LP to the provider", async function () {
      const amt = 1000n * E18;
      await qi.mint(user.address, amt);
      await usdc.mint(user.address, amt);
      await qi.connect(user).approve(await router.getAddress(), amt);
      await usdc.connect(user).approve(await router.getAddress(), amt);

      await router
        .connect(user)
        .addLiquidity(await qi.getAddress(), await usdc.getAddress(), amt, amt, user.address, FAR_DEADLINE);

      expect(await pair.balanceOf(user.address)).to.be.greaterThan(0n);
    });

    it("removes liquidity and returns the underlying tokens", async function () {
      const amt = 1000n * E18;
      await qi.mint(user.address, amt);
      await usdc.mint(user.address, amt);
      await qi.connect(user).approve(await router.getAddress(), amt);
      await usdc.connect(user).approve(await router.getAddress(), amt);
      await router
        .connect(user)
        .addLiquidity(await qi.getAddress(), await usdc.getAddress(), amt, amt, user.address, FAR_DEADLINE);

      const lp = await pair.balanceOf(user.address);
      await pair.connect(user).approve(await router.getAddress(), lp);
      await router
        .connect(user)
        .removeLiquidity(await qi.getAddress(), await usdc.getAddress(), lp, user.address, FAR_DEADLINE);

      expect(await pair.balanceOf(user.address)).to.equal(0n);
      expect(await qi.balanceOf(user.address)).to.be.greaterThan(0n);
      expect(await usdc.balanceOf(user.address)).to.be.greaterThan(0n);
    });
  });

  describe("QRouteRouter — cross-shard bridge callback (C2)", function () {
    it("rejects a non-relayer caller", async function () {
      await expect(
        router
          .connect(other)
          .onTokenBridgeReceived(ethers.id("m1"), await qi.getAddress(), await usdc.getAddress(), 1n, 0, user.address, FAR_DEADLINE)
      ).to.be.revertedWith("QRoute: NOT_RELAYER");
    });

    it("prevents replay of the same messageId", async function () {
      await router.setRelayer(relayer.address, true);
      // Fund the router as if bridged tokens arrived.
      const amt = 100n * E18;
      await qi.mint(await router.getAddress(), amt);

      const mid = ethers.id("bridge-msg-1");
      await router
        .connect(relayer)
        .onTokenBridgeReceived(mid, await qi.getAddress(), await usdc.getAddress(), amt, 0, user.address, FAR_DEADLINE);

      await expect(
        router
          .connect(relayer)
          .onTokenBridgeReceived(mid, await qi.getAddress(), await usdc.getAddress(), amt, 0, user.address, FAR_DEADLINE)
      ).to.be.revertedWith("QRoute: REPLAY");
    });
  });

  describe("Access control (M5)", function () {
    it("only owner can set fee / relayer / feeTo", async function () {
      await expect(router.connect(other).setProtocolFeeBips(50)).to.be.reverted;
      await expect(router.connect(other).setRelayer(relayer.address, true)).to.be.reverted;
      await expect(router.connect(other).setFeeTo(other.address)).to.be.reverted;
    });

    it("rejects a protocol fee above the 1% ceiling", async function () {
      await expect(router.setProtocolFeeBips(101)).to.be.revertedWith("QRoute: FEE_TOO_HIGH");
    });

    it("only owner can register pairs", async function () {
      await expect(
        registry.connect(other).registerPair(await qi.getAddress(), await usdc.getAddress(), other.address)
      ).to.be.reverted;
    });
  });
});
