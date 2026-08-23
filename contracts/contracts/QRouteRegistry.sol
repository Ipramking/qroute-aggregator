// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title QRouteRegistry
/// @notice Trusted registry of canonical pairs. The router looks pairs up here
///         instead of trusting a caller-supplied address — this is the fix for
///         audit C3 (arbitrary/fake pair injection). Pairs are deployed directly
///         (to satisfy Quai shard scoping) and registered by the owner, rather
///         than created via in-contract CREATE2.
contract QRouteRegistry is Ownable {
    // token => token => pair (stored both directions)
    mapping(address => mapping(address => address)) private _pairs;
    address[] public allPairs;

    event PairRegistered(address indexed token0, address indexed token1, address indexed pair);

    constructor() Ownable(msg.sender) {}

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    /// @notice Look up the registered pair for an unordered token pair.
    function getPair(address tokenA, address tokenB) external view returns (address) {
        return _pairs[tokenA][tokenB];
    }

    /// @notice Register a directly-deployed pair. Owner-only.
    function registerPair(address tokenA, address tokenB, address pair) external onlyOwner {
        require(tokenA != tokenB, "QRoute: IDENTICAL_ADDRESSES");
        require(tokenA != address(0) && tokenB != address(0), "QRoute: ZERO_ADDRESS");
        require(pair != address(0), "QRoute: ZERO_PAIR");
        require(_pairs[tokenA][tokenB] == address(0), "QRoute: PAIR_EXISTS");

        _pairs[tokenA][tokenB] = pair;
        _pairs[tokenB][tokenA] = pair;
        allPairs.push(pair);

        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        emit PairRegistered(token0, token1, pair);
    }
}
