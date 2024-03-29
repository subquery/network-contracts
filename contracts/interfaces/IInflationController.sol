// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

interface IInflationController {
    function inflationRate() external view returns (uint256);

    function setInflationRate(uint256 _inflationRateBP) external;

    function setInflationDestination(address _inflationDestination) external;

    function mintInflatedTokens() external;
}
