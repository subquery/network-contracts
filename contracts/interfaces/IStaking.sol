// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

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

    function getTotalEffectiveStake(address _indexer) external view returns (uint256);

    function getTotalStakingAmount(address _indexer) external view returns (uint256);

    function getDelegationAmount(address _delegator, address _indexer) external view returns (uint256);

    function setInitialCommissionRate(address indexer, uint256 rate) external;

    function setCommissionRate(uint256 rate) external;

    function getCommissionRate(address indexer) external view returns (uint256);

    //    function checkAndReflectSettlement(uint256 currentEra, address indexer)
    //        external
    //        returns (bool);
}
