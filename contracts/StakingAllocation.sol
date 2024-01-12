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
import './interfaces/IStakingAllocation.sol';
import './Constants.sol';
import './utils/MathUtil.sol';

/**
 * @title Staking Allocation Contract
 * @notice ### Overview
 * The staking allocated by indexer to different projects(deployments)
 */
contract StakingAllocation is IStakingAllocation, Initializable, OwnableUpgradeable {
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
        IndexerAllocation storage ia = indexers[_indexer];
        uint256 oldTotal = ia.total;
        ia.total = _amount;

        if (oldTotal >= ia.used && ia.total < ia.used) {
            // new overflow
            ia.overflowAt = block.timestamp;
        } else if(oldTotal < ia.used && ia.total >= ia.used) {
            // recover overflow
            ia.overflowTime += block.timestamp - ia.overflowAt;
        }
    }

    function allocate(bytes32 _deployment, uint256 _amount) external {
        uint256 oldAmount = allocations[msg.sender][_deployment];
        IndexerAllocation storage ia = indexers[msg.sender];

        // create new allocation
        if (ia.startTime == 0) {
            ia.startTime = block.timestamp;
        }

        uint256 extra = 0;

        if (oldAmount > _amount) {
            extra = oldAmount - _amount;
            ia.used -= extra;
        } else {
            extra = _amount - oldAmount;
            require(ia.total - ia.used >= extra, 'SA01');
            ia.used += extra;
        }
        allocations[msg.sender][_deployment] = _amount;

        // Update new total staking
        IRewardsBooster rb = IRewardsBooster(settings.getContractAddress(SQContracts.RewardsBooster));
        rb.updateDeploymentAllocated(_deployment, extra, oldAmount < _amount);
    }

    function allocation(address _indexer, bytes32 _deployment) external view returns (uint256) {
        return allocations[_indexer][_deployment];
    }

    function indexer(address _indexer) external view returns (IndexerAllocation memory) {
        return indexers[_indexer];
    }

    function overflowTime(address _indexer) external view returns (uint256) {
        IndexerAllocation memory ia = indexers[_indexer];
        if (ia.total < ia.used) {
            return ia.overflowTime + block.timestamp - ia.overflowAt;
        } else {
            return ia.overflowTime;
        }
    }

    function isSuspended(address _indexer) external view returns (bool) {
        return indexers[_indexer].total < indexers[_indexer].used;
    }
}
