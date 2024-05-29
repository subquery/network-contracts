// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/IStakingManager.sol';
import './interfaces/ISettings.sol';
import './interfaces/ISQToken.sol';
import './interfaces/IRewardsBooster.sol';
import './interfaces/IStakingAllocation.sol';
import './interfaces/IIndexerRegistry.sol';
import './interfaces/IProjectRegistry.sol';
import './Constants.sol';
import './utils/MathUtil.sol';

/**
 * @title Staking Allocation Contract
 * @notice ### Overview
 * The contract allows runner to manage (allocate) their stakings to different deployments
 * onStakeUpdate() is called from RewardsStaking contract, so it is align with RewardsStaking regards total staking. (It may delay when
 * runner stop applying its staking changes), and a total rewards is stored as a duplication.
 *
 * One runner,deployment pair can only have one deployment allocation. Deployment allocations don't have their own unique key.
 *
 * Accumulated over allocation time is also tracked in this contract. How much of it will affect the allocation rewards is
 * further tracked and calculated from RewardsBooster contract, with an additional storage per deployment
 */
contract StakingAllocation is IStakingAllocation, Initializable, OwnableUpgradeable {
    using SafeERC20 for IERC20;
    using MathUtil for uint256;

    // -- Storage --

    ISettings public settings;

    // The idle staking need allocated to projects
    mapping(address => RunnerAllocation) private _runnerAllocations;

    // The staking allocated by runner to different projects(deployments)
    // runner => deployment => amount
    mapping(address => mapping(bytes32 => uint256)) public allocatedTokens;

    // total allocation on the deployment
    mapping(bytes32 => uint256) public deploymentAllocations;

    // -- Events --
    event StakeAllocationAdded(bytes32 deploymentId, address runner, uint256 amount);
    event StakeAllocationRemoved(bytes32 deploymentId, address runner, uint256 amount);
    event OverAllocationStarted(address runner, uint256 start);
    event OverAllocationEnded(address runner, uint256 end, uint256 time);
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

    /**
     * @notice called from RewardsStaking, when runner's first stake or when runner applies staking changes
     * this is the only entry may turn a runner into over allocation.
     * Be note that stake update may be delay if runner stop syncing staking changes.
     */
    function onStakeUpdate(address _runner) external {
        require(msg.sender == settings.getContractAddress(SQContracts.RewardsStaking), 'SAL01');
        RunnerAllocation storage ia = _runnerAllocations[_runner];
        ia.total = IStakingManager(settings.getContractAddress(SQContracts.StakingManager))
            .getEffectiveTotalStake(_runner);

        if (ia.overflowAt == 0 && ia.total < ia.used) {
            // new overflow
            emit OverAllocationStarted(_runner, block.timestamp);

            ia.overflowAt = block.timestamp;
        } else if (ia.overflowAt != 0 && ia.total >= ia.used) {
            // recover from overflow
            emit OverAllocationEnded(_runner, block.timestamp, block.timestamp - ia.overflowAt);

            ia.overflowTime += block.timestamp - ia.overflowAt;
            ia.overflowAt = 0;
        }
    }

    function addAllocation(bytes32 _deployment, address _runner, uint256 _amount) external {
        require(_isAuth(_runner), 'SAL02');
        require(
            IProjectRegistry(settings.getContractAddress(SQContracts.ProjectRegistry))
                .isServiceAvailable(_deployment, _runner),
            'SAL05'
        );

        // collect rewards (if any) before change allocation
        IRewardsBooster rb = IRewardsBooster(
            settings.getContractAddress(SQContracts.RewardsBooster)
        );
        rb.collectAllocationReward(_deployment, _runner);

        RunnerAllocation storage ia = _runnerAllocations[_runner];
        require(ia.total - ia.used >= _amount, 'SAL03');
        ia.used += _amount;
        deploymentAllocations[_deployment] += _amount;
        allocatedTokens[_runner][_deployment] += _amount;

        emit StakeAllocationAdded(_deployment, _runner, _amount);
    }

    function removeAllocation(bytes32 _deployment, address _runner, uint256 _amount) external {
        require(_isAuth(_runner), 'SAL02');
        require(allocatedTokens[_runner][_deployment] >= _amount, 'SAL04');

        _removeAllocation(_deployment, _runner, _amount);
    }

    function stopService(bytes32 _deployment, address _runner) external {
        require(msg.sender == settings.getContractAddress(SQContracts.ProjectRegistry), 'SAL06');
        uint256 amount = allocatedTokens[_runner][_deployment];

        _removeAllocation(_deployment, _runner, amount);
    }

    function _removeAllocation(bytes32 _deployment, address _runner, uint256 _amount) private {
        // collect rewards (if any) before change allocation
        IRewardsBooster rb = IRewardsBooster(
            settings.getContractAddress(SQContracts.RewardsBooster)
        );
        rb.collectAllocationReward(_deployment, _runner);

        RunnerAllocation storage ia = _runnerAllocations[_runner];

        ia.used -= _amount;
        // TODO: split to add and remove
        deploymentAllocations[_deployment] -= _amount;
        allocatedTokens[_runner][_deployment] -= _amount;
        if (ia.overflowAt != 0 && ia.total >= ia.used) {
            // recover from overflow
            emit OverAllocationEnded(_runner, block.timestamp, block.timestamp - ia.overflowAt);

            ia.overflowTime += block.timestamp - ia.overflowAt;
            ia.overflowAt = 0;
        }

        emit StakeAllocationRemoved(_deployment, _runner, _amount);
    }

    function runnerAllocation(address _runner) external view returns (RunnerAllocation memory) {
        return _runnerAllocations[_runner];
    }

    /**
     * @notice this returns the accumulated overflowTime of given runner
     */
    function overAllocationTime(address _runner) external view returns (uint256) {
        RunnerAllocation memory ia = _runnerAllocations[_runner];
        if (ia.total < ia.used) {
            return ia.overflowTime + block.timestamp - ia.overflowAt;
        } else {
            return ia.overflowTime;
        }
    }

    function isOverAllocation(address _runner) external view returns (bool) {
        return _runnerAllocations[_runner].total < _runnerAllocations[_runner].used;
    }

    function _isAuth(address _runner) private view returns (bool) {
        IIndexerRegistry indexerRegistry = IIndexerRegistry(
            ISettings(settings).getContractAddress(SQContracts.IndexerRegistry)
        );
        address controller = indexerRegistry.getController(_runner);
        return msg.sender == _runner || msg.sender == controller;
    }
}
