// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol';

import './interfaces/IStakingManager.sol';
import './interfaces/ISettings.sol';
import './interfaces/IEraManager.sol';
import './interfaces/IRewardsPool.sol';
import './interfaces/IRewardsDistributor.sol';
import './interfaces/ISQToken.sol';
import './utils/FixedMath.sol';
import './utils/MathUtil.sol';
import './utils/StakingUtil.sol';

/**
 * @title Rewards Pool Contract
 * @notice ### Overview
 * The Rewards Pool using the Cobb-Douglas production function for PAYG and Open Agreement
 */
contract RewardsPool is IRewardsPool, Initializable, OwnableUpgradeable {
    using ERC165CheckerUpgradeable for address;
    using SafeERC20 for IERC20;
    using MathUtil for uint256;

    /// @notice Deployment Reward Pool
    struct Pool {
        // total staking in this Pool
        uint256 totalStake;
        // total amount of the deployment
        uint256 totalReward;
        // total unclaimed labor
        uint256 unclaimTotalLabor;
        // total unclaimed reward
        uint256 unclaimReward;
        // staking: runner => staking amount
        mapping(address => uint256) stake;
        // labor: runner => Labor reward
        mapping(address => uint256) labor;
    }

    /// @notice Runner Deployment
    struct RunnerDeployment {
        // unclaimed deployments count
        uint unclaim;
        // deployments list
        bytes32[] deployments;
        // deployments list index
        mapping(bytes32 => uint) index;
    }

    /// @notice Era Reward Pool
    struct EraPool {
        // record the unclaimed deployment
        uint256 totalUnclaimedDeployment;
        // record the runner joined deployments, and check if all is claimed
        mapping(address => RunnerDeployment) unclaimedDeployments;
        // storage all pools by deployment: deployment => Pool
        mapping(bytes32 => Pool) pools;
    }

    /// @dev ### STATES
    /// @notice Settings info
    ISettings public settings;
    /// @notice Era Rewards Pools: era => Era Pool
    mapping(uint256 => EraPool) private pools;
    /// @notice the numerator of Percentage of the stake and labor (1-alpha) in the total
    int32 public alphaNumerator;
    /// @notice the denominator of the alpha
    int32 public alphaDenominator;

    /// @dev ### EVENTS
    /// @notice Emitted when update the alpha for cobb-douglas function
    event Alpha(int32 alphaNumerator, int32 alphaDenominator);
    /// @notice Emitted when add Labor(reward) for current era pool
    event Labor(bytes32 deploymentId, address runner, uint256 amount, uint256 total);
    /// @notice Emitted when collect reward (stake) from era pool
    event Collect(bytes32 deploymentId, address runner, uint256 era, uint256 amount);

    /**
     * @dev ### FUNCTIONS
     * @notice Initialize the contract, setup the alphaNumerator, alphaDenominator
     * @param _settings settings contract address
     */
    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        alphaNumerator = 1;
        alphaDenominator = 3;
        settings = _settings;
    }

    /**
     * @notice update the settings
     * @param _settings settings contract address
     */
    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    /**
     * @notice Update the alpha for cobb-douglas function
     * @param _alphaNumerator the numerator of the alpha
     * @param _alphaDenominator the denominator of the alpha
     */
    function setAlpha(int32 _alphaNumerator, int32 _alphaDenominator) public onlyOwner {
        require(_alphaNumerator > 0 && _alphaDenominator > 0, "RP001");
        alphaNumerator = _alphaNumerator;
        alphaDenominator = _alphaDenominator;

        emit Alpha(alphaNumerator, alphaDenominator);
    }

    /**
     * @notice get the Pool reward by deploymentId, era and runner. returns my labor and total reward
     * @param deploymentId deployment id
     * @param era era number
     * @param runner runner address
     */
    function getReward(bytes32 deploymentId, uint256 era, address runner) public view returns (uint256, uint256) {
        Pool storage pool = pools[era].pools[deploymentId];
        return (pool.labor[runner], pool.totalReward);
    }

    /**
     * @notice Add Labor(reward) for current era pool
     * @param deploymentId deployment id
     * @param runner runner address
     * @param amount the labor of services
     */
    function labor(bytes32 deploymentId, address runner, uint256 amount) external {
        require(amount > 0, 'RP002');
        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransferFrom(msg.sender, address(this), amount);

        uint256 era = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
        EraPool storage eraPool = pools[era];
        Pool storage pool = eraPool.pools[deploymentId];

        // deployment created firstly.
        if (pool.totalReward == 0) {
            eraPool.totalUnclaimedDeployment += 1;
        }

        // runner joined the deployment pool firstly.
        if (pool.labor[runner] == 0) {
            IStakingManager stakingManager = IStakingManager(settings.getContractAddress(SQContracts.StakingManager));
            uint256 myStake = stakingManager.getEffectiveTotalStake(runner);
            if (myStake == 0) {
                // skip unclaimDeployments change, this runner can not claim
                // if this is the only reward this pool get in this era, the reward is locked forever in the pool
                pool.totalReward += amount;
                pool.unclaimReward += amount;
                emit Labor(deploymentId, runner, 0, pool.totalReward);
                return;
            }
            pool.stake[runner] = myStake;
            pool.totalStake += myStake;
        }

        // init deployments list
        RunnerDeployment storage runnerDeployment = eraPool.unclaimedDeployments[runner];
        if (runnerDeployment.deployments.length == 0) {
            runnerDeployment.deployments.push(0); // only for skip 0;
        }
        if (runnerDeployment.index[deploymentId] == 0) {
            runnerDeployment.unclaim += 1;
            runnerDeployment.deployments.push(deploymentId);
            runnerDeployment.index[deploymentId] = runnerDeployment.unclaim;
        }

        pool.labor[runner] += amount;
        pool.totalReward += amount;
        pool.unclaimTotalLabor += amount;
        pool.unclaimReward += amount;

        emit Labor(deploymentId, runner, amount, pool.totalReward);
    }

    /**
     * @notice Collect reward (stake) from previous era Pool
     * @param deploymentId deployment id
     * @param runner runner address
     */
    function collect(bytes32 deploymentId, address runner) external {
        uint256 currentEra = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
        _collect(currentEra - 1, deploymentId, runner);
    }

    /**
     * @notice Batch collect all deployments from previous era Pool
     * @param runner runner address
     */
    function batchCollect(address runner) external {
        uint256 currentEra = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
        _batchCollect(currentEra - 1, runner);
    }

    /**
     * @notice Collect reward (stake) from era pool
     * @param era era number
     * @param deploymentId deployment id
     * @param runner runner address
     */
    function collectEra(uint256 era, bytes32 deploymentId, address runner) external {
        uint256 currentEra = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
        require(currentEra > era, 'RP004');
        _collect(era, deploymentId, runner);
    }

    /**
     * @notice Batch collect all deployments in pool
     * @param era era number
     * @param runner runner address
     */
    function batchCollectEra(uint256 era, address runner) external {
        uint256 currentEra = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
        require(currentEra > era, 'RP004');
        _batchCollect(era, runner);
    }

    /**
     * @notice Determine is the pool claimed on the era
     * @param era era number
     * @param runner runner address
     * @return bool is claimed or not
     */
    function isClaimed(uint256 era, address runner) external view returns (bool) {
        return pools[era].unclaimedDeployments[runner].unclaim == 0;
    }

    /**
     * @notice Get unclaim deployments for the era
     * @param era era number
     * @param runner runner address
     * @return bytes32List list of deploymentIds
     */
    function getUnclaimDeployments(uint256 era, address runner) external view returns (bytes32[] memory) {
        return pools[era].unclaimedDeployments[runner].deployments;
    }

    /// @dev PRIVATE FUNCTIONS
    /// @notice work for batchCollect() and batchCollectEra()
    function _batchCollect(uint256 era, address runner) private {
        EraPool storage eraPool = pools[era];
        RunnerDeployment storage runnerDeployment = eraPool.unclaimedDeployments[runner];
        uint lastIndex = runnerDeployment.unclaim;
        for (uint i = lastIndex; i > 0; i--) {
            bytes32 deploymentId = runnerDeployment.deployments[i];
            _collect(era, deploymentId, runner);
        }
    }

    /// @notice work for collect() and collectEra()
    function _collect(uint256 era, bytes32 deploymentId, address runner) private {
        EraPool storage eraPool = pools[era];
        Pool storage pool = eraPool.pools[deploymentId];
        // this is to prevent duplicated collect
        require(pool.totalStake > 0 && pool.totalReward > 0 && pool.labor[runner] > 0, 'RP005');

        uint256 amount = _cobbDouglas(pool.totalReward, pool.labor[runner], pool.stake[runner], pool.totalStake);

        address rewardDistributer = settings.getContractAddress(SQContracts.RewardsDistributor);
        IRewardsDistributor distributer = IRewardsDistributor(rewardDistributer);
        IERC20(settings.getContractAddress(SQContracts.SQToken)).approve(rewardDistributer, amount);
        if (amount > 0) {
            distributer.addInstantRewards(runner, address(this), amount, era);
        }

        RunnerDeployment storage runnerDeployment = eraPool.unclaimedDeployments[runner];
        uint index = runnerDeployment.index[deploymentId];
        bytes32 lastDeployment = runnerDeployment.deployments[runnerDeployment.unclaim];
        runnerDeployment.deployments[index] = lastDeployment;
        runnerDeployment.deployments.pop();
        runnerDeployment.index[lastDeployment] = index;
        delete runnerDeployment.index[deploymentId];
        runnerDeployment.unclaim -= 1;
        if (runnerDeployment.unclaim == 0) {
            delete eraPool.unclaimedDeployments[runner];
        }

        pool.unclaimTotalLabor -= pool.labor[runner];
        pool.unclaimReward -= amount;
        delete pool.labor[runner];
        delete pool.stake[runner];

        if (pool.unclaimTotalLabor == 0) {
            // burn the remained
            if (pool.unclaimReward > 0) {
                address treasury = settings.getContractAddress(SQContracts.Treasury);
                IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransfer(treasury, pool.unclaimReward);
            }

            delete eraPool.pools[deploymentId];
            eraPool.totalUnclaimedDeployment -= 1;

            // if unclaimed pool == 0, delete the era
            if (eraPool.totalUnclaimedDeployment == 0) {
                delete pools[era];
            }
        }

        emit Collect(deploymentId, runner, era, amount);
    }

    /// @notice The cobb-doublas function has the form:
    /// @notice `reward * feeRatio ^ alpha * stakeRatio ^ (1-alpha)`
    /// @notice This is equivalent to:
    /// @notice `reward * stakeRatio * e^(alpha * (ln(feeRatio / stakeRatio)))`
    /// @notice However, because `ln(x)` has the domain of `0 < x < 1`
    /// @notice and `exp(x)` has the domain of `x < 0`,
    /// @notice and fixed-point math easily overflows with multiplication,
    /// @notice we will choose the following if `stakeRatio > feeRatio`:
    /// @notice `reward * stakeRatio / e^(alpha * (ln(stakeRatio / feeRatio)))`
    function _cobbDouglas(uint256 reward, uint256 myLabor, uint256 myStake, uint256 totalStake) private view returns (uint256) {
        if (myStake == totalStake) {
            return reward;
        }

        int256 feeRatio = FixedMath.toFixed(myLabor, reward);
        int256 stakeRatio = FixedMath.toFixed(myStake, totalStake);
        if (feeRatio == 0 || stakeRatio == 0) {
            return 0;
        }

        // Compute
        // `e^(alpha * ln(feeRatio/stakeRatio))` if feeRatio <= stakeRatio
        // or
        // `e^(alpa * ln(stakeRatio/feeRatio))` if feeRatio > stakeRatio
        int256 n = feeRatio <= stakeRatio
            ? FixedMath.div(feeRatio, stakeRatio)
            : FixedMath.div(stakeRatio, feeRatio);
        n = FixedMath.exp(
            FixedMath.mulDiv(
                FixedMath.ln(n),
                int256(alphaNumerator),
                int256(alphaDenominator)
            )
        );
        // Compute
        // `reward * n` if feeRatio <= stakeRatio
        // or
        // `reward / n` if stakeRatio > feeRatio
        // depending on the choice we made earlier.
        n = feeRatio <= stakeRatio
            ? FixedMath.mul(stakeRatio, n)
            : FixedMath.div(stakeRatio, n);
        // Multiply the above with reward.
        return FixedMath.uintMul(n, reward);
    }
}
