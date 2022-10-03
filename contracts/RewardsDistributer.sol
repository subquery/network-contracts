// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/IStaking.sol';
import './interfaces/ISettings.sol';
import './interfaces/IEraManager.sol';
import './interfaces/IPermissionedExchange.sol';
import './interfaces/IPermissionedExchange.sol';
import './interfaces/IRewardsDistributer.sol';
import './interfaces/IRewardsPool.sol';
import './interfaces/IRewardsStaking.sol';
import './interfaces/IServiceAgreementRegistry.sol';
import './Constants.sol';
import './utils/MathUtil.sol';

/**
 * @title Rewards Distributer Contract
 * @notice ### Overview
 * The Rewards distributer contract tracks and distriubtes the rewards Era by Era.
 * In each distribution, Indexers can take the commission part of rewards, the remaining
 * rewards are distributed according to the staking amount of indexers and delegators.
 *
 * ### Terminology
 * Era -- Era is the period of reward distribution. In our design, we must distribute the rewards of the previous Era
 * before we can move to the next Era.
 * Commission Rate -- Commission Rates are set by Indexers, it is the proportion to be taken by the indexer in each
 * reward distribution.
 * Rewards -- Rewards are paid by comsumer for the service agreements with indexer. All the rewards are
 * temporary hold by RewardsDistributer contract and distribute to Indexers and Delegator Era by Era.
 *
 * ### Detail
 * In the design of rewards distribution, we have added a trade-off mechanism for Indexer and
 * Delegator to achieve a win-win situation.
 * The more SQT token staked on an indexer, the higher limitation of ongoing agreements the indexer can have. In order to earn more rewards with extra agreements,
 * Indexers can stake more to themself, or attract delegators delegate to them, and delegators can share the
 * rewards base on their delegation.
 * This distribution strategy ensures the quality of service and makes both indexers and delegators profitable.
 *
 * We apply delegation amount changes at next era and commission rate changes are applied at two Eras later. We design this
 * to allow time for the delegators to consider their delegation when an Indxer changes the commission rate. But the first stake
 * change and commission rate change of an indexer that made on registration are applied immediately, In this way, the rewards
 * on the era that indexer registered can also be distributed correctly.
 *
 * After the service agreements generated from PlanManager and PurchaseOfferMarket, the rewards paied by consumer are temporary hold by
 * RewardsDistributer contract. RewardsDistributer first linearly split these rewards into Eras according to the era period and the period
 * of the agreement. The distribution information are stored in eraRewardAddTable and eraRewardRemoveTable.
 * In the specific distribution process, we calculate the rewards need to be distributed according to eraRewardAddTable and eraRewardRemoveTable,
 * and distribute to Indexers and Delegators according to their stake amount at that time.
 * Indexer's commission part of the rewards will transfer to indexer immediately after each distribution. And Indexer and delegator can claim
 * accumulated rewards by call claim() any time.
 *
 */
contract RewardsDistributer is IRewardsDistributer, Initializable, OwnableUpgradeable, Constants {
    using SafeERC20 for IERC20;
    using MathUtil for uint256;

    /**
     * @notice Reward information. One per Indexer.
     */
    struct RewardInfo {
        uint256 accSQTPerStake;
        mapping(address => uint256) rewardDebt;
        uint256 lastClaimEra;
        uint256 eraReward;
        mapping(uint256 => uint256) eraRewardAddTable;
        mapping(uint256 => uint256) eraRewardRemoveTable;
    }

    /// @dev ### STATES
    /// @notice ISettings contract which stores SubQuery network contracts address
    ISettings private settings;
    /// @notice Reward information: indexer => RewardInfo
    mapping(address => RewardInfo) private info;

    /// @dev ### EVENTS
    /// @notice Emitted when rewards are distributed for the earliest pending distributed Era.
    event DistributeRewards(address indexed indexer, uint256 indexed eraIdx, uint256 rewards);
    /// @notice Emitted when user claimed rewards.
    event ClaimRewards(address indexed indexer, address indexed delegator, uint256 rewards);
    /// @notice Emitted when the rewards change, such as when rewards coming from new agreement.
    event RewardsChanged(address indexed indexer, uint256 indexed eraIdx, uint256 additions, uint256 removals);

    modifier onlyRewardsStaking() {
        require(msg.sender == settings.getRewardsStaking(), 'Only RewardsStaking');
        _;
    }

    /**
     * @dev FUNCTIONS
     * @notice Initialize this contract.
     */
    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        //Settings
        settings = _settings;
    }

    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    /**
     * @notice Initialize the indexer first last claim era.
     * Only RewardsStaking can call.
     * @param indexer address
     * @param era uint256
     */
    function setLastClaimEra(address indexer, uint256 era) external onlyRewardsStaking {
        info[indexer].lastClaimEra = era;
    }

    /**
     * @notice Update delegator debt in rewards.
     * Only RewardsStaking can call.
     * @param indexer address
     * @param delegator address
     * @param amount uint256
     */
    function setRewardDebt(address indexer, address delegator, uint256 amount) external onlyRewardsStaking {
        info[indexer].rewardDebt[delegator] = amount;
    }

    /**
     * @notice Reset era reward.
     * Only RewardsStaking can call.
     * @param indexer address
     * @param era uint256
     */
    function resetEraReward(address indexer, uint256 era) external onlyRewardsStaking {
        if (info[indexer].eraRewardRemoveTable[era] == 0) {
            info[indexer].eraReward = 0;
        }
    }

    /**
     * @notice Split rewards from agreemrnt into Eras:
     * Rewards split into one era;
     * Rewards split into two eras;
     * Rewards split into more then two eras handled by splitEraSpanMore;
     * Use eraRewardAddTable and eraRewardRemoveTable to store and track reward split info at RewardInfo.
     * Only be called by ServiceAgreementRegistry contract when new agreement accepted.
     * @param agreementId agreement Id
     */
    function increaseAgreementRewards(uint256 agreementId) external {
        require(settings.getServiceAgreementRegistry() == msg.sender, 'Only ServiceAgreementRegistry');
        ClosedServiceAgreementInfo memory agreement = IServiceAgreementRegistry(settings.getServiceAgreementRegistry()).getClosedServiceAgreement(agreementId);
        require(agreement.consumer != address(0), 'Invalid agreemenrt');
        IEraManager eraManager = IEraManager(settings.getEraManager());

        address indexer = agreement.indexer;
        uint256 agreementPeriod = agreement.period;
        uint256 agreementValue = agreement.lockedAmount;
        uint256 agreementStartDate = agreement.startDate;
        uint256 agreementStartEra = eraManager.timestampToEraNumber(agreementStartDate);
        uint256 eraPeriod = eraManager.eraPeriod();

        IERC20(settings.getSQToken()).safeTransferFrom(msg.sender, address(this), agreementValue);

        uint256 estAgreementEnd = agreementStartDate + agreementPeriod;
        uint256 firstEraPortion = MathUtil.min(eraManager.eraStartTime() + (agreementStartEra - eraManager.eraNumber() + 1) * eraPeriod, estAgreementEnd) - agreementStartDate;

        RewardInfo storage rewardInfo = info[indexer];

        if (firstEraPortion == agreementPeriod) {
            // span in one era
            rewardInfo.eraRewardAddTable[agreementStartEra] += agreementValue;
            rewardInfo.eraRewardRemoveTable[agreementStartEra + 1] += agreementValue;
        } else if (agreementPeriod <= eraPeriod + firstEraPortion) {
            // span in two era
            uint256 firstEraReward = MathUtil.mulDiv(firstEraPortion, agreementValue, agreementPeriod);
            uint256 lastEraReward = MathUtil.sub(agreementValue, firstEraReward);
            rewardInfo.eraRewardAddTable[agreementStartEra] += firstEraReward;

            uint256 postEndEra = agreementStartEra + 2;
            rewardInfo.eraRewardAddTable[agreementStartEra + 1] += firstEraReward < lastEraReward ? lastEraReward - firstEraReward : firstEraReward - lastEraReward;
            rewardInfo.eraRewardRemoveTable[postEndEra] += lastEraReward;

            _emitRewardsChangedEvent(indexer, postEndEra, rewardInfo);
        } else {
            // span in > two eras
            uint256 firstEraReward = MathUtil.mulDiv(firstEraPortion, agreementValue, agreementPeriod);
            rewardInfo.eraRewardAddTable[agreementStartEra] += firstEraReward;
            uint256 restEras = MathUtil.divUp(agreementPeriod - firstEraPortion, eraPeriod);
            uint256 rewardForMidEra = MathUtil.mulDiv(eraPeriod, agreementValue, agreementPeriod);
            rewardInfo.eraRewardAddTable[agreementStartEra + 1] += rewardForMidEra - firstEraReward;
            uint256 rewardForLastEra = MathUtil.sub(MathUtil.sub(agreementValue, firstEraReward), rewardForMidEra * (restEras - 1));
            if (rewardForLastEra <= rewardForMidEra) {
                uint256 rewardMinus = MathUtil.sub(rewardForMidEra, rewardForLastEra);
                rewardInfo.eraRewardRemoveTable[restEras + agreementStartEra] += rewardMinus;
                rewardInfo.eraRewardRemoveTable[restEras + agreementStartEra + 1] += rewardForLastEra;
            } else {
                // this could happen due to rounding that rewardForLastEra is one larger than rewardForMidEra
                uint256 rewardAdd = MathUtil.sub(rewardForLastEra, rewardForMidEra);
                rewardInfo.eraRewardAddTable[restEras + agreementStartEra] += rewardAdd;
                rewardInfo.eraRewardRemoveTable[restEras + agreementStartEra + 1] += rewardForLastEra;
            }

            uint256 lastEra = MathUtil.divUp(agreementPeriod - firstEraPortion, eraPeriod) + agreementStartEra;
            // Last era
            _emitRewardsChangedEvent(indexer, lastEra, rewardInfo);

            // Post last era
            _emitRewardsChangedEvent(indexer, lastEra + 1, rewardInfo);
        }

        // Current era will always change
        _emitRewardsChangedEvent(indexer, agreementStartEra, rewardInfo);

        // Next era will always change
        _emitRewardsChangedEvent(indexer, agreementStartEra + 1, rewardInfo);
    }

    /**
     * @notice Send rewards directly to the specified era.
     * Maybe RewardsPool call or others contracts.
     * @param indexer address
     * @param sender address
     * @param amount uint256
     * @param era uint256
     */
    function addInstantRewards(address indexer, address sender, uint256 amount, uint256 era) external {
        require(era <= _getCurrentEra(), 'Waiting Era');
        require(era >= info[indexer].lastClaimEra, 'Era expired');
        IERC20(settings.getSQToken()).safeTransferFrom(sender, address(this), amount);

        RewardInfo storage rewardInfo = info[indexer];
        rewardInfo.eraRewardAddTable[era] += amount;
        rewardInfo.eraRewardRemoveTable[era + 1] += amount;

        // Current era will always change
        _emitRewardsChangedEvent(indexer, era, rewardInfo);

        // Next era will always change
        _emitRewardsChangedEvent(indexer, era + 1, rewardInfo);
    }

    /**
     * @notice check if the current Era is claimed.
     */
    function collectAndDistributeRewards(address indexer) public {
        // check current era is after lastClaimEra
        uint256 currentEra = _getCurrentEra();
        require(info[indexer].lastClaimEra < currentEra - 1, 'Waiting next era');
        collectAndDistributeEraRewards(currentEra, indexer);
    }

    /**
     * @notice Calculate and distribute the rewards for the next Era of the lastClaimEra.
     * Calculate by eraRewardAddTable and eraRewardRemoveTable.
     * Distribute by distributeRewards method.
     */
    function collectAndDistributeEraRewards(uint256 currentEra, address indexer) public returns (uint256) {
        RewardInfo storage rewardInfo = info[indexer];
        require(rewardInfo.lastClaimEra > 0, 'Invalid indexer');
        // skip when it has been claimed for currentEra - 1, no throws
        if (rewardInfo.lastClaimEra >= currentEra - 1) {
            return rewardInfo.lastClaimEra;
        }

        IRewardsStaking rewardsStaking = IRewardsStaking(settings.getRewardsStaking());
        rewardsStaking.checkAndReflectSettlement(indexer, rewardInfo.lastClaimEra);
        require(rewardInfo.lastClaimEra <= rewardsStaking.getLastSettledEra(indexer), 'Pending stake or ICR');

        rewardInfo.lastClaimEra++;

        // claim rewards pool.
        IRewardsPool rewardsPool = IRewardsPool(settings.getRewardsPool());
        rewardsPool.batchCollectEra(rewardInfo.lastClaimEra, indexer);

        rewardInfo.eraReward += rewardInfo.eraRewardAddTable[rewardInfo.lastClaimEra];
        rewardInfo.eraReward -= rewardInfo.eraRewardRemoveTable[rewardInfo.lastClaimEra];
        delete rewardInfo.eraRewardAddTable[rewardInfo.lastClaimEra];
        delete rewardInfo.eraRewardRemoveTable[rewardInfo.lastClaimEra];
        if (rewardInfo.eraReward != 0) {
            uint256 totalStake = rewardsStaking.getTotalStakingAmount(indexer);
            require(totalStake > 0, 'Non-Indexer');

            uint256 commissionRate = rewardsStaking.getCommissionRate(indexer);
            uint256 commission = MathUtil.mulDiv(commissionRate, rewardInfo.eraReward, PER_MILL);

            info[indexer].accSQTPerStake += MathUtil.mulDiv(rewardInfo.eraReward - commission, PER_TRILL, totalStake);
            IERC20(settings.getSQToken()).safeTransfer(indexer, commission);

            emit DistributeRewards(indexer, rewardInfo.lastClaimEra, commission);

            IPermissionedExchange exchange = IPermissionedExchange(settings.getPermissionedExchange());
            exchange.addQuota(settings.getSQToken(), indexer, commission);
        }
        return rewardInfo.lastClaimEra;
    }

    /**
     * @notice Claim rewards of msg.sender for specific indexer.
     */
    function claim(address indexer) public {
        require(claimFrom(indexer, msg.sender) > 0, 'No rewards');
    }

    /**
     * @notice Claculate the Rewards for user and tranfrer token to user.
     */
    function claimFrom(address indexer, address user) public returns (uint256) {
        uint256 rewards = userRewards(indexer, user);
        if (rewards == 0) return 0;
        info[indexer].rewardDebt[user] += rewards;

        IERC20(settings.getSQToken()).safeTransfer(user, rewards);

        IPermissionedExchange exchange = IPermissionedExchange(settings.getPermissionedExchange());
        exchange.addQuota(settings.getSQToken(), user, rewards);

        emit ClaimRewards(indexer, user, rewards);
        return rewards;
    }

    /**
     * @notice extract for reuse emit RewardsChanged event
     */
    function _emitRewardsChangedEvent(address indexer, uint256 eraNumber, RewardInfo storage rewardInfo) private {
        emit RewardsChanged(indexer, eraNumber, rewardInfo.eraRewardAddTable[eraNumber], rewardInfo.eraRewardRemoveTable[eraNumber]);
    }

    /**
     * @notice Get current Era number from EraManager.
     */
    function _getCurrentEra() private returns (uint256) {
        IEraManager eraManager = IEraManager(settings.getEraManager());
        return eraManager.safeUpdateAndGetEra();
    }

    function userRewards(address indexer, address user) public view returns (uint256) {
        IRewardsStaking rewardsStaking = IRewardsStaking(settings.getRewardsStaking());
        uint256 delegationAmount = rewardsStaking.getDelegationAmount(user, indexer);

        return MathUtil.mulDiv(delegationAmount, info[indexer].accSQTPerStake, PER_TRILL) - info[indexer].rewardDebt[user];
    }

    function getRewardInfo(address indexer) public view returns (IndexerRewardInfo memory) {
        RewardInfo storage reward = info[indexer];
        return IndexerRewardInfo(reward.accSQTPerStake, reward.lastClaimEra, reward.eraReward);
    }

    function getRewardAddTable(address indexer, uint256 era) public view returns (uint256) {
        return info[indexer].eraRewardAddTable[era];
    }

    function getRewardRemoveTable(address indexer, uint256 era) public view returns (uint256) {
        return info[indexer].eraRewardRemoveTable[era];
    }
}
