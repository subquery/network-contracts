// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

interface IConsumerRegistry {
    // check the consumer's controller account
    function isController(address consumer, address controller) external view returns (bool);
}
