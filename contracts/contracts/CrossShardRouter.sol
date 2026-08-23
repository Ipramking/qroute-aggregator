// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IQuaiDEXPair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function swap(uint256 amount0Out, uint256 amount1Out, address to) external;
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

contract CrossShardRouter {
    address public owner;
    address public feeTo;
    uint256 public protocolFeeBips = 10; // 10 bips = 0.1% fee

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

    modifier onlyOwner() {
        require(msg.sender == owner, "Router: ONLY_OWNER");
        _;
    }

    constructor(address _feeTo) {
        owner = msg.sender;
        feeTo = _feeTo;
    }

    function setFeeTo(address _feeTo) external onlyOwner {
        feeTo = _feeTo;
    }

    function setProtocolFeeBips(uint256 _feeBips) external onlyOwner {
        require(_feeBips <= 100, "Router: FEE_TOO_HIGH"); // Max 1%
        protocolFeeBips = _feeBips;
    }

    // Standard Uniswap V2 getAmountOut formula
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountOut) {
        require(amountIn > 0, "Router: INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "Router: INSUFFICIENT_LIQUIDITY");
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        amountOut = numerator / denominator;
    }

    // Local Swap: Swaps on the current shard and sends outputs to a local address
    function localSwap(
        address tokenIn,
        address tokenOut,
        address pairAddress,
        uint256 amountIn,
        uint256 minAmountOut,
        address to
    ) external returns (uint256 amountOut) {
        // Transfer tokens from user
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        amountOut = _executeSwap(tokenIn, tokenOut, pairAddress, amountIn, minAmountOut, to);

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, to, false);
    }

    // Cross-Shard Swap Initiator:
    // User deposits tokens on Shard A, the contract logs a pending swap and initiates
    // the cross-shard transfer to Shard B where the swap will execute, or performs a local swap
    // first and then transfers the final token cross-shard.
    //
    // For this build, we support both routing types. 
    // This function executes the swap locally on Shard A, then transfers the output token 
    // to the recipient's address on Shard B using Quai's native cross-shard transfer.
    function swapAndTransferCrossShard(
        address tokenIn,
        address tokenOut,
        address pairAddress,
        uint256 amountIn,
        uint256 minAmountOut,
        address to, // Recipient address on the destination shard (maps to Shard B)
        uint256 destinationShard
    ) external returns (uint256 amountOut) {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        // Execute local swap on Shard A first
        amountOut = _executeSwap(tokenIn, tokenOut, pairAddress, amountIn, minAmountOut, address(this));

        // Transfer output token cross-shard to the recipient address on Shard B
        // In Quai Network, this is initiated by calling the token's cross-shard transfer.
        // We simulate this by transferring output tokens to the user's address. 
        // The network protocol handles routing to the address prefix automatically.
        IERC20(tokenOut).transfer(to, amountOut);

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, to, true);
        emit LogExternalSwapPending(tokenIn, tokenOut, amountIn, to, destinationShard);
    }

    // Cross-Shard Callback:
    // Invoked on Shard B when tokens are received from Shard A for a swap.
    // The incoming cross-shard bridge calls this function with swap parameters.
    function onTokenBridgeReceived(
        address tokenIn,
        address tokenOut,
        address pairAddress,
        uint256 amountIn,
        uint256 minAmountOut,
        address to
    ) external returns (uint256 amountOut) {
        // Safety check: The tokens must already be present in this contract
        require(IERC20(tokenIn).balanceOf(address(this)) >= amountIn, "Router: INSUFFICIENT_BALANCE");

        amountOut = _executeSwap(tokenIn, tokenOut, pairAddress, amountIn, minAmountOut, to);

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, to, true);
    }

    // Internal swap executor that handles fees and pair interactions
    function _executeSwap(
        address tokenIn,
        address tokenOut,
        address pairAddress,
        uint256 amountIn,
        uint256 minAmountOut,
        address to
    ) internal returns (uint256 amountOut) {
        IQuaiDEXPair pair = IQuaiDEXPair(pairAddress);

        // Deduct protocol fee
        uint256 fee = (amountIn * protocolFeeBips) / 10000;
        uint256 amountAfterFee = amountIn - fee;

        if (fee > 0) {
            IERC20(tokenIn).transfer(feeTo, fee);
        }

        // Send tokens to the pair pool
        IERC20(tokenIn).transfer(pairAddress, amountAfterFee);

        // Calculate swap output
        (uint112 reserve0, uint112 reserve1, ) = pair.getReserves();
        (uint256 reserveIn, uint256 reserveOut) = tokenIn == pair.token0()
            ? (uint256(reserve0), uint256(reserve1))
            : (uint256(reserve1), uint256(reserve0));

        amountOut = getAmountOut(amountAfterFee, reserveIn, reserveOut);
        require(amountOut >= minAmountOut, "Router: INSUFFICIENT_OUTPUT_AMOUNT");

        // Swap execution
        (uint256 amount0Out, uint256 amount1Out) = tokenIn == pair.token0()
            ? (uint256(0), amountOut)
            : (amountOut, uint256(0));

        pair.swap(amount0Out, amount1Out, to);
    }
}
