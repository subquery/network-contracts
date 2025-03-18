// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/access/Ownable.sol';
import '../external/IQuoter.sol';
import '../interfaces/IPriceOracle.sol';

interface IUniswapV3Pool {
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        );

    function token0() external view returns (address);
    function token1() external view returns (address);
}

contract UniswapPriceOracle is Ownable, IPriceOracle {
    IQuoter public quoter; // 0x222ca98f00ed15b1fae10b61c277703a194cf5d2, https://github.com/Uniswap/view-quoter-v3/tree/master
    uint24 public poolFee;

    constructor(address _quoterAddress, uint24 _poolFee) Ownable() {
        quoter = IQuoter(_quoterAddress);
        poolFee = _poolFee;
    }

    function setQuoter(address _quoterAddress) external onlyOwner {
        quoter = IQuoter(_quoterAddress);
    }

    function setPoolFee(uint24 _poolFee) external onlyOwner {
        poolFee = _poolFee;
    }

    function getAssetPrice(
        address fromToken,
        address toToken
    ) external view override returns (uint256) {
        return _convertPrice(fromToken, toToken, 1);
    }

    function convertPrice(
        address fromToken,
        address toToken,
        uint256 amount
    ) external view override returns (uint256) {
        require(amount > 0, 'Amount must be greater than 0');
        return _convertPrice(fromToken, toToken, amount);
    }

    // usdc: 0x833589fcd6edb6e08f4c7c32d4f71b54bda02913
    // sqt: 0x858c50c3af1913b0e849afdb74617388a1a5340d

    function _convertPrice(
        address fromToken,
        address toToken,
        uint256 amount
    ) internal view returns (uint256) {
        // Simulate the swap using the QuoterV2 contract
        IQuoter.QuoteExactInputSingleParams memory params = IQuoter.QuoteExactInputSingleParams({
            tokenIn: fromToken,
            tokenOut: toToken,
            amountIn: amount,
            fee: poolFee,
            sqrtPriceLimitX96: 0 // No price limit
        });

        (uint256 amountOut, , , ) = quoter.quoteExactInputSingle(params);

        return amountOut;
    }
}
