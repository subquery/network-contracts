// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/ISettings.sol';
import './interfaces/IRewardsBooster.sol';
import './interfaces/IIndexerRegistry.sol';
import './Constants.sol';
import './StakingAllocation.sol';
import './utils/MathUtil.sol';

/**
 * @title Staking Allocation Mananger Contract
 * @notice ### Overview
 * Staking Allocation Mananger Contract provides the functionality to manage the staking allocation.
 */
contract AllocationMananger is Initializable, OwnableUpgradeable {
    using SafeERC20 for IERC20;
    using MathUtil for uint256;

    // -- Storage --
    ISettings public settings;

    // -- Functions --

    /**
     * @dev Initialize this contract.
     */
    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        settings = _settings;
    }

    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    function addAllocation(bytes32 _deployment, address _runner, uint256 _amount) external {
        require(_isAuth(_runner), 'SAL02');

        // collect rewards (if any) before change allocation
        IRewardsBooster rb = IRewardsBooster(
            settings.getContractAddress(SQContracts.RewardsBooster)
        );
        rb.collectAllocationReward(_deployment, _runner);
        StakingAllocation(settings.getContractAddress(SQContracts.StakingAllocation)).addAllocation(
            _deployment,
            _runner,
            _amount
        );
    }

    function removeAllocation(bytes32 _deployment, address _runner, uint256 _amount) external {
        require(_isAuth(_runner), 'SAL02');

        StakingAllocation sa = StakingAllocation(
            settings.getContractAddress(SQContracts.StakingAllocation)
        );
        require(sa.allocatedTokens(_runner, _deployment) >= _amount, 'SAL04');

        // collect rewards (if any) before change allocation
        IRewardsBooster rb = IRewardsBooster(
            settings.getContractAddress(SQContracts.RewardsBooster)
        );
        rb.collectAllocationReward(_deployment, _runner);

        sa.removeAllocation(_deployment, _runner, _amount);
    }

    function _isAuth(address _runner) private view returns (bool) {
        IIndexerRegistry indexerRegistry = IIndexerRegistry(
            ISettings(settings).getContractAddress(SQContracts.IndexerRegistry)
        );

        address controller = indexerRegistry.getController(_runner);
        return msg.sender == _runner || msg.sender == controller;
    }
}
