// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

interface IInflationDestination {
    function afterReceiveInflatedTokens(uint256 tokenAmount) external;
}
