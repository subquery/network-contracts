// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol';

import './interfaces/IStaking.sol';
import './interfaces/ISettings.sol';
import './interfaces/IEraManager.sol';
import './interfaces/IRewardsPool.sol';
import './interfaces/IRewardsDistributer.sol';
import './interfaces/ISQToken.sol';
import './Constants.sol';
import './utils/FixedMath.sol';
import './utils/MathUtil.sol';
import './utils/StakingUtil.sol';

/**
 * @title Rewards Pool Contract
 * @dev
 * ## Overview
 * The Rewards Pool using the Cobb-Douglas production function for PAYG and Open Agreement.
 */
contract RewardsPool is IRewardsPool, Initializable, OwnableUpgradeable, Constants {
    using ERC165CheckerUpgradeable for address;
    using SafeERC20 for IERC20;
    using MathUtil for uint256;

    // Deployment Reward Pool.
    struct Pool {
        // total staking in this Pool.
        uint256 totalStake;
        // total amount of the deployment.
        uint256 totalReward;
        // total unclaimed labor;
        uint256 unclaimTotalLabor;
        // total unclaimed reward;
        uint256 unclaimReward;
        // staking: indexer => staking amount
        mapping(address => uint256) stake;
        // labor: indexer => Labor reward
        mapping(address => uint256) labor;
    }

    // Era Reward Pool.
    struct EraPool {
        // record the unclaimed deployment.
        uint256 unclaimDeployment;
        // record the indexer joined deployments, and check if all is claimed.
        mapping(address => uint256) indexerUnclaimDeployments;
        // storage all pools by deployment: deployment => Pool.
        mapping(bytes32 => Pool) pools;
    }

    // Era Rewards Pools: era => Era Pool.
    mapping(uint256 => EraPool) private pools;

    // Settings info.
    ISettings public settings;

    // Percentage of the stake and labor (1-alpha) in the total.
    int32 public alphaNumerator;
    int32 public alphaDenominator;

    event Alpha(int32 alphaNumerator, int32 alphaDenominator);
    event Labor(bytes32 deploymentId, address indexer, uint256 amount, uint256 total);
    event Collect(bytes32 deploymentId, address indexer, uint256 era, uint256 amount);

    // Initial.
    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        alphaNumerator = 1;
        alphaDenominator = 3;
        settings = _settings;
    }

    /**
     * @dev update the settings.
     */
    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    /**
     * @dev Update the alpha for cobb-douglas function.
     * @param _alphaNumerator int32.
     * @param _alphaDenominator int32.
     */
    function setAlpha(int32 _alphaNumerator, int32 _alphaDenominator) public onlyOwner {
        require(_alphaNumerator > 0 && _alphaDenominator > 0, '!alpha');
        alphaNumerator = _alphaNumerator;
        alphaDenominator = _alphaDenominator;

        emit Alpha(alphaNumerator, alphaDenominator);
    }

    /**
     * @dev get the Pool reward by deploymentId, era and indexer. returns my labor and total reward.
     * @param deploymentId byte32.
     * @param era uint256.
     * @param indexer address.
     */
    function getReward(
        bytes32 deploymentId,
        uint256 era,
        address indexer
    ) public view returns (uint256, uint256) {
        Pool storage pool = pools[era].pools[deploymentId];
        return (pool.labor[indexer], pool.totalReward);
    }

    /**
     * @dev Add Labor(reward) for current era pool.
     * @param deploymentId byte32.
     * @param indexer address.
     * @param amount uint256. the labor of services.
     */
    function labor(
        bytes32 deploymentId,
        address indexer,
        uint256 amount
    ) external {
        require(amount > 0, 'Invalid amount');
        IERC20(settings.getSQToken()).safeTransferFrom(msg.sender, address(this), amount);

        uint256 era = IEraManager(settings.getEraManager()).safeUpdateAndGetEra();
        EraPool storage eraPool = pools[era];
        Pool storage pool = eraPool.pools[deploymentId];
        // deployment created firstly.
        if (pool.totalReward == 0) {
            eraPool.unclaimDeployment += 1;
        }
        // indexer joined the pool firstly.
        if (pool.labor[indexer] == 0) {
            eraPool.indexerUnclaimDeployments[indexer] += 1;

            IStaking staking = IStaking(settings.getStaking());
            uint256 myStake = staking.getTotalStakingAmount(indexer);
            require(myStake > 0, 'Not indexer');
            pool.stake[indexer] = myStake;
            pool.totalStake += myStake;
        }
        pool.labor[indexer] += amount;
        pool.totalReward += amount;
        pool.unclaimTotalLabor += amount;
        pool.unclaimReward += amount;

        emit Labor(deploymentId, indexer, amount, pool.totalReward);
    }

    /**
     * @dev Collect reward (stake) from previous era Pool.
     * @param deploymentId byte32.
     * @param indexer address.
     */
    function collect(bytes32 deploymentId, address indexer) external {
        uint256 currentEra = IEraManager(settings.getEraManager()).safeUpdateAndGetEra();
        _collect(currentEra - 1, deploymentId, indexer);
    }

    /**
     * @dev Collect reward (stake) from era pool.
     * @param deploymentId byte32.
     * @param indexer address.
     */
    function collect_era(
        uint256 era,
        bytes32 deploymentId,
        address indexer
    ) external {
        uint256 currentEra = IEraManager(settings.getEraManager()).safeUpdateAndGetEra();
        require(currentEra > era, 'Waiting Era');
        _collect(era, deploymentId, indexer);
    }

    function _collect(
        uint256 era,
        bytes32 deploymentId,
        address indexer
    ) private {
        EraPool storage eraPool = pools[era];
        Pool storage pool = eraPool.pools[deploymentId];
        require(pool.totalReward > 0 && pool.labor[indexer] > 0, 'No reward');

        uint256 amount = _cobbDouglas(pool.totalReward, pool.labor[indexer], pool.stake[indexer], pool.totalStake);

        address rewardDistributer = settings.getRewardsDistributer();
        IRewardsDistributer distributer = IRewardsDistributer(rewardDistributer);
        IERC20(settings.getSQToken()).approve(rewardDistributer, amount);
        distributer.addInstantRewards(indexer, address(this), amount);

        eraPool.indexerUnclaimDeployments[indexer] -= 1;
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

    function isClaimed(uint256 era, address indexer) external view returns (bool) {
        return pools[era].indexerUnclaimDeployments[indexer] == 0;
    }

    function _cobbDouglas(
        uint256 reward,
        uint256 myLabor,
        uint256 myStake,
        uint256 totalStake
    ) private view returns (uint256) {
        int256 feeRatio = FixedMath.toFixed(myLabor, reward);
        int256 stakeRatio = FixedMath.toFixed(myStake, totalStake);
        if (feeRatio == 0 || stakeRatio == 0) {
            return 0;
        }
        // The cobb-doublas function has the form:
        // `reward * feeRatio ^ alpha * stakeRatio ^ (1-alpha)`
        // This is equivalent to:
        // `reward * stakeRatio * e^(alpha * (ln(feeRatio / stakeRatio)))`
        // However, because `ln(x)` has the domain of `0 < x < 1`
        // and `exp(x)` has the domain of `x < 0`,
        // and fixed-point math easily overflows with multiplication,
        // we will choose the following if `stakeRatio > feeRatio`:
        // `reward * stakeRatio / e^(alpha * (ln(stakeRatio / feeRatio)))`

        // Compute
        // `e^(alpha * ln(feeRatio/stakeRatio))` if feeRatio <= stakeRatio
        // or
        // `e^(alpa * ln(stakeRatio/feeRatio))` if feeRatio > stakeRatio
        int256 n = feeRatio <= stakeRatio ? FixedMath.div(feeRatio, stakeRatio) : FixedMath.div(stakeRatio, feeRatio);
        n = FixedMath.exp(FixedMath.mulDiv(FixedMath.ln(n), int256(alphaNumerator), int256(alphaDenominator)));
        // Compute
        // `reward * n` if feeRatio <= stakeRatio
        // or
        // `reward / n` if stakeRatio > feeRatio
        // depending on the choice we made earlier.
        n = feeRatio <= stakeRatio ? FixedMath.mul(stakeRatio, n) : FixedMath.div(stakeRatio, n);
        // Multiply the above with reward.
        return FixedMath.uintMul(n, reward);
    }
}
