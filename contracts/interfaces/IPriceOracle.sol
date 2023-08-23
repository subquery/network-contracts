// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

interface IPriceOracle {
    function getAssetPrice(address assetA, address assetB) external view returns (uint256);
}