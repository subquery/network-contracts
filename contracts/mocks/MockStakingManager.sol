// Copyright (C) 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../interfaces/IStakingManager.sol';

/**
 * @title MockStakingManager
 * @notice Mock implementation of IStakingManager for testing DelegationPool auto-compound functionality
 */
contract MockStakingManager is IStakingManager {
    using SafeERC20 for IERC20;

    IERC20 public sqToken;

    // Track delegations: delegator => runner => amount
    mapping(address => mapping(address => uint256)) public delegations;

    // Track rewards per runner
    mapping(address => uint256) public rewardsPerRunner;

    // Track total delegations per runner
    mapping(address => uint256) public totalDelegationsPerRunner;

    event Delegated(address indexed delegator, address indexed runner, uint256 amount);
    event Undelegated(address indexed delegator, address indexed runner, uint256 amount);
    event Redelegated(
        address indexed delegator,
        address indexed fromRunner,
        address indexed toRunner,
        uint256 amount
    );
    event RewardsClaimed(address indexed delegator, address[] runners, uint256 totalRewards);

    constructor(address _sqToken) {
        sqToken = IERC20(_sqToken);
    }

    /**
     * @notice Set rewards available for a specific runner
     * @dev Test helper function to simulate reward accumulation
     */
    function setRunnerRewards(address _runner, uint256 _rewards) external {
        rewardsPerRunner[_runner] = _rewards;
    }

    /**
     * @notice Fund this contract with SQT tokens for distributing rewards
     * @dev Test helper function
     */
    function fundRewards(uint256 _amount) external {
        sqToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    // IStakingManager implementation

    function stake(address _runner, uint256 _amount) external override {
        revert('Not implemented in mock');
    }

    function unstake(address _runner, uint256 _amount) external override {
        revert('Not implemented in mock');
    }

    function delegate(address _runner, uint256 _amount) external override {
        require(_amount > 0, 'Amount must be greater than 0');

        // Transfer tokens from delegator to this contract
        sqToken.safeTransferFrom(msg.sender, address(this), _amount);

        // Update delegations
        delegations[msg.sender][_runner] += _amount;
        totalDelegationsPerRunner[_runner] += _amount;

        emit Delegated(msg.sender, _runner, _amount);
    }

    function undelegate(address _runner, uint256 _amount) external override {
        require(_amount > 0, 'Amount must be greater than 0');
        require(delegations[msg.sender][_runner] >= _amount, 'Insufficient delegation');

        // Update delegations
        delegations[msg.sender][_runner] -= _amount;
        totalDelegationsPerRunner[_runner] -= _amount;

        // Transfer tokens back to delegator
        sqToken.safeTransfer(msg.sender, _amount);

        emit Undelegated(msg.sender, _runner, _amount);
    }

    function redelegate(address _fromRunner, address _toRunner, uint256 _amount) external override {
        require(_amount > 0, 'Amount must be greater than 0');
        require(delegations[msg.sender][_fromRunner] >= _amount, 'Insufficient delegation');

        // Update delegations
        delegations[msg.sender][_fromRunner] -= _amount;
        delegations[msg.sender][_toRunner] += _amount;
        totalDelegationsPerRunner[_fromRunner] -= _amount;
        totalDelegationsPerRunner[_toRunner] += _amount;

        emit Redelegated(msg.sender, _fromRunner, _toRunner, _amount);
    }

    function widthdraw() external {
        // No-op this is handled in undelegate currently
    }

    function cancelUnbonding(uint256 unbondReqId) external override {
        revert('Not implemented in mock');
    }

    function stakeReward(address _runner) external override {
        uint256 rewards = _calculateDelegatorRewards(msg.sender, _runner);
        if (rewards > 0) {
            // Reset rewards for this runner for this delegator
            rewardsPerRunner[_runner] = 0;

            // Transfer rewards to delegator
            sqToken.safeTransfer(msg.sender, rewards);
        }
    }

    function batchStakeReward(address[] calldata _runners) external override {
        uint256 totalRewards = 0;

        for (uint256 i = 0; i < _runners.length; i++) {
            uint256 rewards = _calculateDelegatorRewards(msg.sender, _runners[i]);
            if (rewards > 0) {
                totalRewards += rewards;
                // Reset rewards for this runner
                rewardsPerRunner[_runners[i]] = 0;
            }
        }

        if (totalRewards > 0) {
            // Transfer total rewards to delegator
            sqToken.safeTransfer(msg.sender, totalRewards);
            emit RewardsClaimed(msg.sender, _runners, totalRewards);
        }
    }

    function slashRunner(address _runner, uint256 _amount) external override {
        revert('Not implemented in mock');
    }

    function getTotalStakingAmount(address _runner) external view override returns (uint256) {
        return totalDelegationsPerRunner[_runner];
    }

    function getEffectiveTotalStake(address _runner) external view override returns (uint256) {
        return totalDelegationsPerRunner[_runner];
    }

    function getAfterDelegationAmount(
        address _delegator,
        address _runner
    ) external view override returns (uint256) {
        return delegations[_delegator][_runner];
    }

    function getDelegationAmount(
        address _delegator,
        address _runner
    ) external view override returns (uint256) {
        return delegations[_delegator][_runner];
    }

    function getEraDelegationAmount(
        address _delegator,
        address _runner,
        uint256 _era
    ) external view override returns (uint256) {
        return delegations[_delegator][_runner];
    }

    // Internal helper functions

    /**
     * @notice Calculate rewards for a specific delegator on a specific runner
     * @dev Proportionally distributes runner rewards based on delegator's share
     */
    function _calculateDelegatorRewards(
        address _delegator,
        address _runner
    ) internal view returns (uint256) {
        uint256 delegatorAmount = delegations[_delegator][_runner];
        if (delegatorAmount == 0) return 0;

        uint256 totalRunnerDelegations = totalDelegationsPerRunner[_runner];
        if (totalRunnerDelegations == 0) return 0;

        uint256 runnerRewards = rewardsPerRunner[_runner];
        if (runnerRewards == 0) return 0;

        // Calculate proportional share of rewards
        return (runnerRewards * delegatorAmount) / totalRunnerDelegations;
    }
}
