// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
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
    mapping(address => RunnerAllocation) private _runnerAllocations;

    // The staking allocated by runner to different projects(deployments)
    // runner => deployment => amount
    mapping(address => mapping(bytes32 => uint256)) public allocatedTokens;

    // total allocation on the deployment
    mapping(bytes32 => uint256) public deploymentAllocations;

    // -- Events --
    event StakeAllocationAdded(bytes32 deploymentId, address runner, uint256 amount);
    event StakeAllocationRemoved(bytes32 deploymentId, address runner, uint256 amount);
    event StakeOverflowStarted(address indexer, uint256 start);
    event StakeOverflowEnded(address indexer, uint256 end, uint256 time);
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

    function onStakeUpdate(address _runner, uint256 _amount) external {
        require(msg.sender == settings.getContractAddress(SQContracts.RewardsStaking), 'SAL01');
        RunnerAllocation storage ia = _runnerAllocations[_runner];
        uint256 total = IStakingManager(settings.getContractAddress(SQContracts.StakingManager)).getEffectiveTotalStake(_runner);

        if (ia.overflowAt == 0 && total < ia.used) {
            // new overflow
            emit StakeOverflowStarted(_runner, block.timestamp);

            ia.overflowAt = block.timestamp;
        } else if (ia.overflowAt != 0 && total >= ia.used) {
            // recover from overflow
            emit StakeOverflowEnded(_runner, block.timestamp, block.timestamp - ia.overflowAt);

            ia.overflowTime += block.timestamp - ia.overflowAt;
            ia.overflowAt = 0;
        }
    }

    function addAllocation(bytes32 _deployment, address _runner, uint256 _amount) external {
        require(_isAuth(_runner), "SAL02");

        // collect rewards (if any) before change allocation
        IRewardsBooster rb = IRewardsBooster(settings.getContractAddress(SQContracts.RewardsBooster));
        rb.collectAllocationReward(_deployment, _runner);

        RunnerAllocation storage ia = _runnerAllocations[_runner];
        uint256 total = IStakingManager(settings.getContractAddress(SQContracts.StakingManager)).getEffectiveTotalStake(_runner);
        require(total - ia.used >= _amount, 'SAL03');
        ia.used += _amount;
        deploymentAllocations[_deployment] += _amount;
        allocatedTokens[_runner][_deployment] += _amount;

        emit StakeAllocationAdded(_deployment, _runner, _amount);
    }

    function removeAllocation(bytes32 _deployment, address _runner, uint256 _amount) external {
        require(_isAuth(_runner), "SAL02");
        require(allocatedTokens[_runner][_deployment] >= _amount, 'SAL04');

        // collect rewards (if any) before change allocation
        IRewardsBooster rb = IRewardsBooster(settings.getContractAddress(SQContracts.RewardsBooster));
        rb.collectAllocationReward(_deployment, _runner);

        RunnerAllocation storage ia = _runnerAllocations[_runner];

        ia.used -= _amount;
        // TODO: split to add and remove
        deploymentAllocations[_deployment] -= _amount;
        allocatedTokens[_runner][_deployment] -= _amount;
        uint256 total = IStakingManager(settings.getContractAddress(SQContracts.StakingManager)).getEffectiveTotalStake(_runner);
        if (ia.overflowAt != 0 && total >= ia.used) {
            // collectAllocationReward had beed overflowClear, so just set overflowAt
            emit StakeOverflowEnded(_runner, block.timestamp, block.timestamp - ia.overflowAt);

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
    function overflowTime(address _runner) external view returns (uint256) {
        RunnerAllocation memory ia = _runnerAllocations[_runner];
        if (isAllocationOverflow(_runner)) {
            return ia.overflowTime + block.timestamp - ia.overflowAt;
        } else {
            return ia.overflowTime;
        }
    }

    function isAllocationOverflow(address _runner) public view returns (bool) {
        uint256 total = IStakingManager(settings.getContractAddress(SQContracts.StakingManager)).getEffectiveTotalStake(_runner);
        return total < _runnerAllocations[_runner].used;
    }

    function _isAuth(address _runner) private view returns (bool) {
        IIndexerRegistry indexerRegistry = IIndexerRegistry(ISettings(settings).getContractAddress(SQContracts.IndexerRegistry));
        address controller = indexerRegistry.getController(_runner);
        return msg.sender == _runner || msg.sender == controller;
    }
}
