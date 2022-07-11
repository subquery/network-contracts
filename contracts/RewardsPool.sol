// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/IStaking.sol';
import './interfaces/ISettings.sol';
import './interfaces/IEraManager.sol';
import './interfaces/IRewardsDistributer.sol';
import './interfaces/IRewardsPool.sol';
import './interfaces/IServiceAgreement.sol';
import './Constants.sol';
import './utils/FixedMath.sol';
import './utils/MathUtil.sol';

/**
 * @title Rewards Pool Contract
 * @dev
 * ## Overview
 * The Rewards Pool using the Cobb-Douglas production function for PAYG and Open Agreement.
 */
contract RewardsPool is IRewardsPool, Initializable, OwnableUpgradeable, Constants {
    using SafeERC20 for IERC20;
    using MathUtil for uint256;

    // Reward Pool.
    struct Pool {
        // the indexer count.
        uint256 count;
        // total amount of deploymentId.
        uint256 reward;
        // total amount of stake.
        uint256 totalStake;
        // stake: indexer => amount
        mapping(address => uint256) stake;
        // labor: indexer => amount
        mapping(address => uint256) labor;
    }

        // Rewards Pools: deployment id => (era => Pool).
    mapping(bytes32 => mapping(uint256 => Pool)) private pools;

    // Settings info.
    ISettings public settings;

    // Percentage of the stake and labor (1-alpha) in the total.
    int32 public alphaNumerator;
    int32 public alphaDenominator;

    event Alpha(int32 alphaNumerator, int32 alphaDenominator);
    event AddStake(bytes32 deploymentId, address indexer, uint256 amount, uint256 total);
    event AddLabor(bytes32 deploymentId, address indexer, uint256 amount, uint256 total);
    event Claim(bytes32 deploymentId, address indexer, uint256 era, uint256 amount);

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
        require(_alphaNumerator > 0 && _alphaDenominator > 0, "!alpha");
        alphaNumerator = _alphaNumerator;
        alphaDenominator = _alphaDenominator;

        emit Alpha(alphaNumerator, alphaDenominator);
    }

    /**
     * @dev get the Pool info by deploymentId, era and indexer.
     * @param deploymentId byte32.
     * @param era uint256.
     * @param indexer address.
     */
    function getPool(bytes32 deploymentId, uint256 era, address indexer) public view returns (uint256, uint256, uint256, uint256, uint256) {
        Pool storage pool = pools[deploymentId][era];
        return (pool.count, pool.reward, pool.totalStake, pool.stake[indexer], pool.labor[indexer]);
    }

    /**
     * @dev Add stake for next era pool.
     * @param deploymentId bytes32.
     * @param indexer address.
     * @param amount uint256. need stake.
     */
    function addStake(bytes32 deploymentId, address indexer, address sender, uint256 amount) external {
        IERC20(settings.getSQToken()).safeTransferFrom(sender, address(this), amount);

        uint256 nextEra = IEraManager(settings.getEraManager()).eraNumber() + 1;
        Pool storage pool = pools[deploymentId][nextEra];
        if (pool.stake[indexer] == 0) {
            pool.count += 1;
        }
        pool.stake[indexer] += amount;
        pool.totalStake += amount;

        emit AddStake(deploymentId, indexer, amount, pool.totalStake);
    }

    /**
     * @dev Add Labor(reward) for current era pool.
     * @param deploymentId byte32.
     * @param indexer address.
     * @param sender address.
     * @param amount uint256. the labor of services.
     */
    function addLabor(bytes32 deploymentId, address indexer, address sender, uint256 amount) external {
        IERC20(settings.getSQToken()).safeTransferFrom(sender, address(this), amount);

        uint256 currentEra = IEraManager(settings.getEraManager()).eraNumber();
        Pool storage pool = pools[deploymentId][currentEra];
        pool.labor[indexer] += amount;
        pool.reward += amount;

        emit AddLabor(deploymentId, indexer, amount, pool.reward);
    }

    /**
     * @dev Claim reward (stake) from previous era Pool.
     * @param deploymentId byte32.
     * @param indexer address.
     * @param restake bool. if re-stake to next era (current era + 1).
     */
    function claim(bytes32 deploymentId, address indexer, bool restake) external {
        uint256 currentEra = IEraManager(settings.getEraManager()).eraNumber();
        require(currentEra > 0, 'Wait Era');
        uint256 era = currentEra - 1;
        uint256 amount = _claim(deploymentId, indexer, era, currentEra + 1, restake);

        emit Claim(deploymentId, indexer, era, amount);
    }

    /**
     * @dev Claim reward (stake) from special era Pool.
     * @param deploymentId byte32.
     * @param indexer address.
     * @param era uint256.
     * @param restake bool. if re-stake to next era (current era + 1).
     */
    function claim_era(bytes32 deploymentId, address indexer, uint256 era, bool restake) external {
        uint256 currentEra = IEraManager(settings.getEraManager()).eraNumber();
        require(currentEra > era, 'Wait Era');
        uint256 amount = _claim(deploymentId, indexer, era, currentEra + 1, restake);

        emit Claim(deploymentId, indexer, era, amount);
    }

    function _claim(bytes32 deploymentId, address indexer, uint256 era, uint256 nextEra, bool restake) private returns (uint256) {
        Pool storage pool = pools[deploymentId][era];
        require(pool.reward > 0 || pool.totalStake > 0, 'No reward or stake');

        uint256 myStake = pool.stake[indexer];
        uint256 myLabor = pool.labor[indexer];
        uint256 amount = _cobbDouglas(pool.reward, myLabor, myStake, pool.totalStake);

        IERC20 token = IERC20(settings.getSQToken());
        if (restake) {
            // re-stake SQT to next era.
            Pool storage nextPool = pools[deploymentId][nextEra];
            if (nextPool.stake[indexer] == 0) {
                nextPool.count += 1;
            }
            nextPool.stake[indexer] += myStake;
            nextPool.totalStake += myStake;
        } else {
            // send stake SQT to indexer.
            token.safeTransfer(indexer, myStake);
        }

        // clear pool info
        delete pool.stake[indexer];
        delete pool.labor[indexer];
        pool.count -= 1;

        // delete pools[deploymentId][era];
        if (pool.count == 0) {
            delete pools[deploymentId][era];
        }

        // reward distributer
        address rewardDistributerAddress = settings.getRewardsDistributer();
        token.approve(rewardDistributerAddress, amount);
        IRewardsDistributer rewardsDistributer = IRewardsDistributer(rewardDistributerAddress);
        rewardsDistributer.addInstantRewards(indexer, address(this), amount);

        return amount;
    }

    function _cobbDouglas(uint256 reward, uint256 labor, uint256 stake, uint256 totalStake) private view returns (uint256) {
        int256 feeRatio = FixedMath.toFixed(labor, reward);
        int256 stakeRatio = FixedMath.toFixed(stake, totalStake);
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
