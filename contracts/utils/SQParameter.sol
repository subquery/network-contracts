// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

abstract contract SQParameter {
    /// @notice Emitted when parameter change.
    event Parameter(string name, bytes value);
}
