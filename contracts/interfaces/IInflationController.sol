// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

interface IInflationController {
    function setInflationRate(uint256 _inflationRateBP) external;

    function setInflationDestination(address _inflationDestination) external;

    function mintInflatedTokens() external;
}
