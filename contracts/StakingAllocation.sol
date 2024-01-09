// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/IStaking.sol';
import './interfaces/ISettings.sol';
import './interfaces/ISQToken.sol';
import './interfaces/IRewardsBooster.sol';
import './Constants.sol';
import './utils/MathUtil.sol';

struct IndexerAllocation {
    uint256 total;
    uint256 used;
}

/**
 * @title Staking Allocation Contract
 * @notice ### Overview
 * The staking allocated by indexer to different projects(deployments)
 */
contract StakingAllocation is Initializable, OwnableUpgradeable {
    using SafeERC20 for IERC20;
    using MathUtil for uint256;

    // -- Storage --

    ISettings public settings;

    // The idle staking need allocated to projects
    mapping(address => IndexerAllocation) public indexers;

    // The staking allocated by indexer to different projects(deployments)
    mapping(address => mapping(bytes32 => uint256)) public allocations;

    // -- Events --

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

    function update(address _indexer, uint256 _amount) external {
        require(msg.sender == settings.getContractAddress(SQContracts.Staking), 'SA00');
        indexers[_indexer].total = _amount;
    }

    function allocate(bytes32 _deployment, uint256 _amount) external {
        // Settle old rewards
        IRewardsBooster rb = IRewardsBooster(settings.getContractAddress(SQContracts.RewardsBooster));
        rb.settleReward(msg.sender, _deployment);

        uint256 oldAmount = allocations[msg.sender][_deployment];
        uint256 extra = 0;

        if (oldAmount > _amount) {
            extra = oldAmount - _amount;
            indexers[msg.sender].used -= extra;
        } else {
            extra = _amount - oldAmount;
            require(indexers[msg.sender].total - indexers[msg.sender].used >= extra, 'SA01');
            indexers[msg.sender].used += extra;
        }
        allocations[msg.sender][_deployment] = _amount;

        // Update new total staking
        rb.updateDeploymentAllocated(_deployment, extra, oldAmount < _amount);
    }

    function allocation(address _indexer, bytes32 _deployment) external view returns (uint256) {
        return allocations[_indexer][_deployment];
    }

    function isSuspended(address _indexer) external view returns (bool) {
        return indexers[_indexer].total < indexers[_indexer].used;
    }
}
