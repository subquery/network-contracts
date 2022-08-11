// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

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

    function currentCommission(CommissionRate memory rate, uint256 era) internal pure returns (uint256) {
        if ((rate.era + 1) < era) {
            return rate.valueAfter;
        } else {
            return rate.valueAt;
        }
    }

    function currentDelegation(StakingAmount memory amount, uint256 era) internal pure returns (uint256) {
        if (amount.era < era) {
            return amount.valueAfter;
        }
        return amount.valueAt;
    }
}