// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

interface IPermissionedExchange {
    function addQuota(address _token, address _account, uint256 _amount) external;
}
