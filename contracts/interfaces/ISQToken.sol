// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

interface ISQToken {
    function mint(address destination, uint256 amount) external;

    function burn(uint256 amount) external;
}
