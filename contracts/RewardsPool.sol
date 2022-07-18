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

    // Labor and Reward for indexer.
    struct LaborReward {
        uint256 labor;
        uint256 accSQTPerStake;
        uint256 unclaim;
    }

    // Deployment Reward Pool.
    struct Pool {
        // total amount of the deployment.
        uint256 totalReward;
        // labor: indexer => LaborReward
        mapping(address => LaborReward) labor;
    }

    // Era Rewards Pools: era => deployment => Pool.
    mapping(uint256 => mapping(bytes32 => Pool)) private pools;

    // Settings info.
    ISettings public settings;

    // Percentage of the stake and labor (1-alpha) in the total.
    int32 public alphaNumerator;
    int32 public alphaDenominator;

    event Alpha(int32 alphaNumerator, int32 alphaDenominator);
    event Labor(bytes32 deploymentId, address indexer, uint256 amount, uint256 total);
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

    /* /\** */
    /*  * @dev get the Pool info by deploymentId, era and indexer. */
    /*  * @param deploymentId byte32. */
    /*  * @param era uint256. */
    /*  * @param indexer address. */
    /*  *\/ */
    /* function getPool(bytes32 deploymentId, uint256 era, address indexer) public view returns (uint256, uint256, uint256, uint256, uint256) { */
    /*     Pool storage pool = pools[deploymentId][era]; */
    /*     return (pool.count, pool.reward, pool.totalStake, pool.stake[indexer], pool.labor[indexer]); */
    /* } */

    /**
     * @dev Add Labor(reward) for current era pool.
     * @param deploymentId byte32.
     * @param indexer address.
     * @param amount uint256. the labor of services.
     */
    function labor(bytes32 deploymentId, address indexer, uint256 amount) external {
        IERC20(settings.getSQToken()).safeTransferFrom(msg.sender, address(this), amount);

        uint256 era = IEraManager(settings.getEraManager()).eraNumber();
        Pool storage pool = pools[era][deploymentId];
        pool.labor[indexer].labor += amount;
        pool.totalReward += amount;

        emit Labor(deploymentId, indexer, amount, pool.totalReward);
    }

    /**
     * @dev Claim reward (stake) from previous era Pool.
     * @param deploymentId byte32.
     * @param indexer address.
     */
    function claim(bytes32 deploymentId, address indexer) external {
        uint256 currentEra = IEraManager(settings.getEraManager()).eraNumber();
        require(currentEra > 0, 'Wait Era');
        uint256 era = currentEra - 1;
        IStaking staking = IStaking(settings.getStaking());

        // TODO clear previous pool info, and burn unclaim reward.
        // delete pools[era - 1];

        Pool storage pool = pools[era][deploymentId];
        require(pool.totalReward > 0, 'No reward');

        uint256 totalStake = StakingUtil.previous_staking(staking.getStaking(), currentEra);
        uint256 myStake = StakingUtil.previous_staking(staking.getStaking(indexer), currentEra);
        uint256 myCommission = StakingUtil.previous_commission(staking.getCommission(indexer), currentEra);

        LaborReward storage myLabor = pool.labor[indexer];
        uint256 amount = _cobbDouglas(pool.totalReward, myLabor.labor, myStake, totalStake);

        // distribute reward to indexer and delegators.
        uint256 indexerAmount = MathUtil.mulDiv(myCommission, amount, PER_MILL);
        myLabor.unclaim = amount - indexerAmount;
        myLabor.accSQTPerStake = MathUtil.mulDiv(amount - indexerAmount, PER_TRILL, myStake);

        IERC20 token = IERC20(settings.getSQToken());
        token.safeTransfer(indexer, indexerAmount);

        emit Claim(deploymentId, indexer, era, amount);
    }

    /**
     * @dev Claim delegator reward from previous era Pool.
     * @param deploymentId byte32.
     * @param delegator address.
     * @param indexer address.
     */
    function claim_delegation(bytes32 deploymentId, address delegator, address indexer) external {
        uint256 currentEra = IEraManager(settings.getEraManager()).eraNumber();
        require(currentEra > 0, 'Wait Era');
        uint256 era = currentEra - 1;
        LaborReward storage myLabor = pools[era][deploymentId].labor[indexer];
        require(myLabor.unclaim > 0, 'No reward');
        IStaking staking = IStaking(settings.getStaking());

        StakingAmount memory amount = staking.getDelegation(delegator, indexer);
        uint256 delegation = StakingUtil.previous_delegation(amount, currentEra);

        uint256 reward = delegation * myLabor.accSQTPerStake;
        myLabor.unclaim -= reward;

        IERC20 token = IERC20(settings.getSQToken());
        token.safeTransfer(delegator, reward);
    }

    function _cobbDouglas(uint256 reward, uint256 myLabor, uint256 myStake, uint256 totalStake) private view returns (uint256) {
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
