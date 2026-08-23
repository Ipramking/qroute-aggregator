// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IQRoutePair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1);
    function swap(uint256 amount0Out, uint256 amount1Out, address to) external;
}

interface IQRouteRegistry {
    function getPair(address tokenA, address tokenB) external view returns (address);
}

/// @title QRouteRouter
/// @notice Hardened cross-shard swap router.
/// @dev Fixes vs the original CrossShardRouter:
///      - C3: pairs are resolved from the trusted registry; callers never pass a
///        pair address, so fake/malicious pairs can't be injected.
///      - C2: `onTokenBridgeReceived` is restricted to whitelisted relayers and is
///        replay-protected by a per-message nonce (idempotent).
///      - H1: `nonReentrant` on all external state-changing swap paths.
///      - H2: all token transfers use SafeERC20.
///      - H5: every swap takes a `deadline`.
///      - M5: privileged setters are `onlyOwner` (point this at a multisig in prod).
contract QRouteRouter is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IQRouteRegistry public immutable registry;
    address public feeTo;
    uint256 public protocolFeeBips = 10; // 0.1%
    uint256 public constant MAX_FEE_BIPS = 100; // 1% ceiling

    mapping(address => bool) public bridgeRelayers;
    mapping(bytes32 => bool) public processedMessages;

    event SwapExecuted(
        address indexed sender,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address to,
        bool isCrossShard
    );
    event LogExternalSwapPending(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        address to,
        uint256 destinationShard
    );
    event FeeToUpdated(address indexed feeTo);
    event ProtocolFeeUpdated(uint256 bips);
    event RelayerUpdated(address indexed relayer, bool allowed);

    modifier ensure(uint256 deadline) {
        require(block.timestamp <= deadline, "QRoute: EXPIRED");
        _;
    }

    constructor(address _registry, address _feeTo) Ownable(msg.sender) {
        require(_registry != address(0) && _feeTo != address(0), "QRoute: ZERO_ADDRESS");
        registry = IQRouteRegistry(_registry);
        feeTo = _feeTo;
    }

    // ---------------------------------------------------------------- admin

    function setFeeTo(address _feeTo) external onlyOwner {
        require(_feeTo != address(0), "QRoute: ZERO_ADDRESS");
        feeTo = _feeTo;
        emit FeeToUpdated(_feeTo);
    }

    function setProtocolFeeBips(uint256 _bips) external onlyOwner {
        require(_bips <= MAX_FEE_BIPS, "QRoute: FEE_TOO_HIGH");
        protocolFeeBips = _bips;
        emit ProtocolFeeUpdated(_bips);
    }

    function setRelayer(address relayer, bool allowed) external onlyOwner {
        require(relayer != address(0), "QRoute: ZERO_ADDRESS");
        bridgeRelayers[relayer] = allowed;
        emit RelayerUpdated(relayer, allowed);
    }

    // ------------------------------------------------------------- quoting

    /// @notice Standard Uniswap-V2 getAmountOut (0.3% pool fee).
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        public
        pure
        returns (uint256 amountOut)
    {
        require(amountIn > 0, "QRoute: INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "QRoute: INSUFFICIENT_LIQUIDITY");
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        amountOut = numerator / denominator;
    }

    // --------------------------------------------------------------- swaps

    /// @notice Swap on the origin shard and deliver output locally.
    function localSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address to,
        uint256 deadline
    ) external nonReentrant ensure(deadline) returns (uint256 amountOut) {
        require(to != address(0), "QRoute: ZERO_TO");
        address pair = _pairFor(tokenIn, tokenOut);

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        amountOut = _executeSwap(tokenIn, pair, amountIn, minAmountOut, to);

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, to, false);
    }

    /// @notice Swap locally then flag the output for a cross-shard delivery.
    /// @dev The actual cross-shard settlement is handled off-chain by a relayer in
    ///      Phase 3; this emits the intent. Kept honest: does NOT itself move tokens
    ///      across shards (a plain ERC20 transfer cannot — Quai needs a native ETx).
    function swapAndFlagCrossShard(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address to,
        uint256 destinationShard,
        uint256 deadline
    ) external nonReentrant ensure(deadline) returns (uint256 amountOut) {
        require(to != address(0), "QRoute: ZERO_TO");
        address pair = _pairFor(tokenIn, tokenOut);

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        amountOut = _executeSwap(tokenIn, pair, amountIn, minAmountOut, address(this));

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, to, true);
        emit LogExternalSwapPending(tokenIn, tokenOut, amountIn, to, destinationShard);
    }

    /// @notice Cross-shard callback invoked on the destination shard once bridged
    ///         tokens have arrived. Relayer-gated and replay-protected.
    function onTokenBridgeReceived(
        bytes32 messageId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address to,
        uint256 deadline
    ) external nonReentrant ensure(deadline) returns (uint256 amountOut) {
        require(bridgeRelayers[msg.sender], "QRoute: NOT_RELAYER");
        require(!processedMessages[messageId], "QRoute: REPLAY");
        require(to != address(0), "QRoute: ZERO_TO");
        processedMessages[messageId] = true;

        address pair = _pairFor(tokenIn, tokenOut);
        require(
            IERC20(tokenIn).balanceOf(address(this)) >= amountIn,
            "QRoute: INSUFFICIENT_BALANCE"
        );

        amountOut = _executeSwap(tokenIn, pair, amountIn, minAmountOut, to);
        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, to, true);
    }

    // ------------------------------------------------------------ internal

    function _pairFor(address tokenIn, address tokenOut) internal view returns (address pair) {
        pair = registry.getPair(tokenIn, tokenOut);
        require(pair != address(0), "QRoute: NO_PAIR");
    }

    function _executeSwap(
        address tokenIn,
        address pair,
        uint256 amountIn,
        uint256 minAmountOut,
        address to
    ) internal returns (uint256 amountOut) {
        // Take the protocol fee first (on the input token).
        uint256 fee = (amountIn * protocolFeeBips) / 10000;
        uint256 amountAfterFee = amountIn - fee;
        if (fee > 0) {
            IERC20(tokenIn).safeTransfer(feeTo, fee);
        }

        address t0 = IQRoutePair(pair).token0();
        (uint112 r0, uint112 r1) = IQRoutePair(pair).getReserves();
        (uint256 reserveIn, uint256 reserveOut) =
            tokenIn == t0 ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));

        amountOut = getAmountOut(amountAfterFee, reserveIn, reserveOut);
        require(amountOut >= minAmountOut, "QRoute: INSUFFICIENT_OUTPUT_AMOUNT");

        IERC20(tokenIn).safeTransfer(pair, amountAfterFee);

        (uint256 amount0Out, uint256 amount1Out) =
            tokenIn == t0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
        IQRoutePair(pair).swap(amount0Out, amount1Out, to);
    }
}
