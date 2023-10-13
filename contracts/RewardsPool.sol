// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol';

import './Constants.sol';
import './interfaces/IStakingManager.sol';
import './interfaces/ISettings.sol';
import './interfaces/IEraManager.sol';
import './interfaces/IRewardsPool.sol';
import './interfaces/IRewardsDistributer.sol';
import './interfaces/ISQToken.sol';
import './utils/FixedMath.sol';
import './utils/MathUtil.sol';
import './utils/StakingUtil.sol';

/**
 * @title Rewards Pool Contract
 * @notice ### Overview
 * The Rewards Pool using the Cobb-Douglas production function for PAYG and Open Agreement
 */
contract RewardsPool is IRewardsPool, Initializable, OwnableUpgradeable, Constants {
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
        // staking: indexer => staking amount
        mapping(address => uint256) stake;
        // labor: indexer => Labor reward
        mapping(address => uint256) labor;
    }

    /// @notice Indexer Deployment
    struct IndexerDeployment {
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
        uint256 unclaimDeployment;
        // record the indexer joined deployments, and check if all is claimed
        mapping(address => IndexerDeployment) indexerUnclaimDeployments;
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
    event Labor(bytes32 deploymentId, address indexer, uint256 amount, uint256 total);
    /// @notice Emitted when collect reward (stake) from era pool
    event Collect(bytes32 deploymentId, address indexer, uint256 era, uint256 amount);

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
     * @notice get the Pool reward by deploymentId, era and indexer. returns my labor and total reward
     * @param deploymentId deployment id
     * @param era era number
     * @param indexer indexer address
     */
    function getReward(bytes32 deploymentId, uint256 era, address indexer) public view returns (uint256, uint256) {
        Pool storage pool = pools[era].pools[deploymentId];
        return (pool.labor[indexer], pool.totalReward);
    }

    /**
     * @notice Add Labor(reward) for current era pool
     * @param deploymentId deployment id
     * @param indexer indexer address
     * @param amount the labor of services
     */
    function labor(bytes32 deploymentId, address indexer, uint256 amount) external {
        require(amount > 0, 'RP002');
        IERC20(settings.getSQToken()).safeTransferFrom(msg.sender, address(this), amount);

        uint256 era = IEraManager(settings.getEraManager()).safeUpdateAndGetEra();
        EraPool storage eraPool = pools[era];
        Pool storage pool = eraPool.pools[deploymentId];
        IndexerDeployment storage indexerDeployment = eraPool.indexerUnclaimDeployments[indexer];

        // deployment created firstly.
        if (pool.totalReward == 0) {
            eraPool.unclaimDeployment += 1;
        }

        uint256 laborAdd = amount;
        // indexer joined the deployment pool firstly.
        if (pool.labor[indexer] == 0) {
            IStakingManager stakingManager = IStakingManager(settings.getStakingManager());
            uint256 myStake = stakingManager.getTotalStakingAmount(indexer);
            pool.stake[indexer] = myStake;
            pool.totalStake += myStake;
            if (myStake == 0) {
                laborAdd = 0;
            }
        }

        // init deployments list
        if (indexerDeployment.deployments.length == 0) {
            indexerDeployment.deployments.push(0); // only for skip 0;
        }
        if (indexerDeployment.index[deploymentId] == 0) {
            indexerDeployment.unclaim += 1;
            indexerDeployment.deployments.push(deploymentId);
            indexerDeployment.index[deploymentId] = indexerDeployment.unclaim;
        }

        pool.labor[indexer] += laborAdd;
        pool.totalReward += amount;
        pool.unclaimTotalLabor += laborAdd;
        pool.unclaimReward += amount;

        emit Labor(deploymentId, indexer, laborAdd, pool.totalReward);
    }

    /**
     * @notice Collect reward (stake) from previous era Pool
     * @param deploymentId deployment id
     * @param indexer indexer address
     */
    function collect(bytes32 deploymentId, address indexer) external {
        uint256 currentEra = IEraManager(settings.getEraManager()).safeUpdateAndGetEra();
        _collect(currentEra - 1, deploymentId, indexer);
    }

    /**
     * @notice Batch collect all deployments from previous era Pool
     * @param indexer indexer address
     */
    function batchCollect(address indexer) external {
        uint256 currentEra = IEraManager(settings.getEraManager()).safeUpdateAndGetEra();
        _batchCollect(currentEra - 1, indexer);
    }

    /**
     * @notice Collect reward (stake) from era pool
     * @param era era number
     * @param deploymentId deployment id
     * @param indexer indexer address
     */
    function collectEra(uint256 era, bytes32 deploymentId, address indexer) external {
        uint256 currentEra = IEraManager(settings.getEraManager()).safeUpdateAndGetEra();
        require(currentEra > era, 'RP004');
        _collect(era, deploymentId, indexer);
    }

    /**
     * @notice Batch collect all deployments in pool
     * @param era era number
     * @param indexer indexer address
     */
    function batchCollectEra(uint256 era, address indexer) external {
        uint256 currentEra = IEraManager(settings.getEraManager()).safeUpdateAndGetEra();
        require(currentEra > era, 'RP004');
        _batchCollect(era, indexer);
    }

    /**
     * @notice Determine is the pool claimed on the era
     * @param era era number
     * @param indexer indexer address
     * @return bool is claimed or not
     */
    function isClaimed(uint256 era, address indexer) external view returns (bool) {
        return pools[era].indexerUnclaimDeployments[indexer].unclaim == 0;
    }

    /**
     * @notice Get unclaim deployments for the era
     * @param era era number
     * @param indexer indexer address
     * @return bytes32List list of deploymentIds
     */
    function getUnclaimDeployments(uint256 era, address indexer) external view returns (bytes32[] memory) {
        return pools[era].indexerUnclaimDeployments[indexer].deployments;
    }

    /// @dev PRIVATE FUNCTIONS
    /// @notice work for batchCollect() and batchCollectEra()
    function _batchCollect(uint256 era, address indexer) private {
        EraPool storage eraPool = pools[era];
        IndexerDeployment storage indexerDeployment = eraPool.indexerUnclaimDeployments[indexer];
        uint lastIndex = indexerDeployment.unclaim;
        for (uint i = lastIndex; i > 0; i--) {
            bytes32 deploymentId = indexerDeployment.deployments[i];
            _collect(era, deploymentId, indexer);
        }
    }

    /// @notice work for collect() and collectEra()
    function _collect(uint256 era, bytes32 deploymentId, address indexer) private {
        EraPool storage eraPool = pools[era];
        Pool storage pool = eraPool.pools[deploymentId];
        // when only one indexer in the pool and that indexer has unregistered, it's possible that
        // totalReward > 0 while labor and stake = 0, in this case we burn the reward
        if (pool.totalReward == 0) {
            return;
        }

        uint256 amount = _cobbDouglas(pool.totalReward, pool.labor[indexer], pool.stake[indexer], pool.totalStake);

        address rewardDistributer = settings.getRewardsDistributer();
        IRewardsDistributer distributer = IRewardsDistributer(rewardDistributer);
        IERC20(settings.getSQToken()).approve(rewardDistributer, amount);
        if (amount > 0) {
            distributer.addInstantRewards(indexer, address(this), amount, era);
        }

        IndexerDeployment storage indexerDeployment = eraPool.indexerUnclaimDeployments[indexer];
        uint index = indexerDeployment.index[deploymentId];
        bytes32 lastDeployment = indexerDeployment.deployments[indexerDeployment.unclaim];
        indexerDeployment.deployments[index] = lastDeployment;
        indexerDeployment.deployments.pop();
        indexerDeployment.index[lastDeployment] = index;
        delete indexerDeployment.index[deploymentId];
        indexerDeployment.unclaim -= 1;
        if (indexerDeployment.unclaim == 0) {
            delete eraPool.indexerUnclaimDeployments[indexer];
        }

        pool.unclaimTotalLabor -= pool.labor[indexer];
        pool.unclaimReward -= amount;
        delete pool.labor[indexer];
        delete pool.stake[indexer];

        if (pool.unclaimTotalLabor == 0) {
            // burn the remained
            if (pool.unclaimReward > 0) {
                ISQToken token = ISQToken(settings.getSQToken());
                token.burn(pool.unclaimReward);
            }

            delete eraPool.pools[deploymentId];
            eraPool.unclaimDeployment -= 1;

            // if unclaimed pool == 0, delete the era
            if (eraPool.unclaimDeployment == 0) {
                delete pools[era];
            }
        }

        emit Collect(deploymentId, indexer, era, amount);
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
        if (myLabor == 0 || myStake == 0 || totalStake == 0) {
            return 0;
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
