// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

interface IStakingManager {
    function stake(address _runner, uint256 _amount) external;

    function unstake(address _runner, uint256 _amount) external;

    function delegate(address _runner, uint256 _amount) external;

    function undelegate(address _runner, uint256 _amount) external;

    function redelegate(address _fromRunner, address _toRunner, uint256 _amount) external;

    function cancelUnbonding(uint256 unbondReqId) external;

    function stakeReward(address _runner) external;

    function batchStakeReward(address[] calldata _runners) external;

    function slashRunner(address _runner, uint256 _amount) external;

    function getTotalStakingAmount(address _runner) external view returns (uint256);

    function getEffectiveTotalStake(address _runner) external view returns (uint256);

    function getAfterDelegationAmount(
        address _delegator,
        address _runner
    ) external view returns (uint256);

    function getDelegationAmount(
        address _delegator,
        address _runner
    ) external view returns (uint256);

    function getEraDelegationAmount(
        address _delegator,
        address _runner,
        uint256 _era
    ) external view returns (uint256);
}
