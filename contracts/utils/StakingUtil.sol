// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

import '../interfaces/IStaking.sol';

/**
 * @title Staking helper utils.
 * @dev
 */
library StakingUtil {
    function currentStaking(StakingAmount memory amount, uint256 era) internal pure returns (uint256) {
        if (amount.era < era) {
            return amount.valueAfter;
        }
        return amount.valueAt;
    }

    function currentDelegation(StakingAmount memory amount, uint256 era) internal pure returns (uint256) {
        if (amount.era < era) {
            return amount.valueAfter;
        }
        return amount.valueAt;
    }
}
