// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

/**
 * @dev Total staking amount information. One per Indexer.
 * Stake amount change need to be applied at next Era.
 */
struct StakingAmount {
    uint256 era;         // last update era
    uint256 valueAt;     // value at the era
    uint256 valueBefore; // value at previous era
    uint256 valueAfter;  // value to be refreshed from next era
}

/**
 * @dev Commission rate information. One per Indexer.
 * Commission rate change need to be applied at the Era after next Era.
 */
struct CommissionRate {
    uint256 era;         // last update era
    uint256 valueAt;     // value at the era
    uint256 valueBefore; // value at previous era
    uint256 valueAfter;  // value to be refreshed from next era
}

/**
 * @dev Unbond amount information. One per request per Delegator.
 * Delegator can withdraw the unbond amount after the lockPeriod.
 */
struct UnbondAmount {
    uint256 amount;    // pending unbonding amount
    uint256 startTime; // unbond start time
}

interface IStaking {
    function stake(address _indexer, uint256 _amount) external;

    function unstake(address _indexer, uint256 _amount) external;

    function delegate(address _delegator, uint256 _amount) external;

    function redelegate(
        address from_indexer,
        address to_indexer,
        uint256 _amount
    ) external;

    function undelegate(address _indexer, uint256 _amount) external;

    function widthdraw() external;

    // Get indexer total staking amount.
    function getStaking(address _indexer) external view returns (StakingAmount memory);

    // Get indexer commission rate.
    function getCommission(address _indexer) external view returns (CommissionRate memory);

    // Get the delegator's staking amount for an indexer.
    function getDelegation(address _delegator, address _indexer) external view returns (StakingAmount memory);

    function getTotalStakingAmount(address _indexer) external view returns (uint256);

    function getTotalEffectiveStake(address _indexer) external view returns (uint256);

    function getDelegationAmount(address _delegator, address _indexer) external view returns (uint256);

    function setInitialCommissionRate(address indexer, uint256 rate) external;

    function setCommissionRate(uint256 rate) external;

    function getCommissionRate(address indexer) external view returns (uint256);

    //    function checkAndReflectSettlement(uint256 currentEra, address indexer)
    //        external
    //        returns (bool);
}
