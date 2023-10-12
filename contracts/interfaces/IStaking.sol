// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

/**
 * @dev Total staking amount information. One per Indexer.
 * Stake amount change need to be applied at next Era.
 */
struct StakingAmount {
    uint256 era;         // last update era
    uint256 valueAt;     // value at the era
    uint256 valueAfter;  // value to be refreshed from next era
}

/**
 * @dev Unbond amount information. One per request per Delegator.
 * Delegator can withdraw the unbond amount after the lockPeriod.
 */
struct UnbondAmount {
    address indexer;   // the indexer before delegate.
    uint256 amount;    // pending unbonding amount
    uint256 startTime; // unbond start time
}

enum UnbondType {
    Undelegation,
    Unstake,
    Commission,
    Merge
}

interface IStaking {
    function lockedAmount(address _delegator) external view returns (uint256);

    function unbondCommission(address _indexer, uint256 _amount) external;
}
