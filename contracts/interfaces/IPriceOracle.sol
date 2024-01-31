// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

interface IPriceOracle {
    function getAssetPrice(address fromToken, address toToken) external view returns (uint256);
    function convertPrice(
        address fromToken,
        address toToken,
        uint256 amount
    ) external view returns (uint256);
}
