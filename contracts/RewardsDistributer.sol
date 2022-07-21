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
import './interfaces/IServiceAgreementRegistry.sol';
import './Constants.sol';
import './utils/MathUtil.sol';

/**
 * @title Rewards Distributer Contract
 * @dev
 * ## Overview
 * The Rewards distributer contract tracks and distriubtes the rewards Era by Era.
 * In each distribution, Indexers can take the commission part of rewards, the remaining
 * rewards are distributed according to the staking amount of indexers and delegators.
 *
 * ## Terminology
 * Era -- Era is the period of reward distribution. In our design, we must distribute the rewards of the previous Era
 * before we can move to the next Era.
 * Commission Rate -- Commission Rates are set by Indexers, it is the proportion to be taken by the indexer in each
 * reward distribution.
 * Rewards -- Rewards are paid by comsumer for the service agreements with indexer. All the rewards are
 * temporary hold by RewardsDistributer contract and distribute to Indexers and Delegator Era by Era.
 *
 * ## Detail
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

    // -- Data --

    /**
     * @dev Reward information. One per Indexer.
     */
    struct RewardInfo {
        uint256 accSQTPerStake;
        mapping(address => uint256) rewardDebt;
        uint256 lastClaimEra;
        uint256 eraReward;
        mapping(uint256 => uint256) eraRewardAddTable;
        mapping(uint256 => uint256) eraRewardRemoveTable;
    }

    // -- Storage --

    ISettings private settings;
    //Reward information: indexer => rewardInfo
    mapping(address => RewardInfo) info;
    //Pending staker address: indexer => indexNumber => staker
    mapping(address => mapping(uint256 => address)) pendingStakers;
    //Pending staker's index number: indexer => staker => indexNumber
    mapping(address => mapping(address => uint256)) pendingStakerNos;
    //Numbers of pending stake changes: indexer => pendingStakeChangeLength
    mapping(address => uint256) pendingStakeChangeLength;
    //Era number of CommissionRateChange should apply: indexer => CommissionRateChange Era number
    mapping(address => uint256) pendingCommissionRateChange;
    //Last settled Era number: indexer => lastSettledEra
    mapping(address => uint256) lastSettledEra;
    //total staking amount per indexer: indexer => totalStakingAmount
    mapping(address => uint256) totalStakingAmount;
    //delegator's delegation amount to indexer: delegator => indexer => delegationAmount
    mapping(address => mapping(address => uint256)) delegation;
    //rewards commission rates per indexer: indexer => commissionRates
    mapping(address => uint256) public commissionRates;

    // -- Events --

    /**
     * @dev Emitted when rewards are distributed for the earliest pending distributed Era.
     */
    event DistributeRewards(address indexed indexer, uint256 indexed eraIdx);
    /**
     * @dev Emitted when user claimed rewards.
     */
    event ClaimRewards(address indexed indexer, address indexed delegator, uint256 rewards);
    /**
     * @dev Emitted when the rewards change, such as when rewards coming from new agreement.
     */
    event RewardsChanged(address indexed indexer, uint256 indexed eraIdx, uint256 additions, uint256 removals);
    /**
     * @dev Emitted when the stake amount change.
     */
    event StakeChanged(address indexed indexer, address indexed staker, uint256 amount);
    /**
     * @dev Emitted when the indexer commission rates change.
     */
    event ICRChanged(address indexed indexer, uint256 commissionRate);
    /**
     * @dev Emitted when lastSettledEra update.
     */
    event SettledEraUpdated(address indexed indexer, uint256 era);

    /**
     * @dev Initialize this contract.
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
     * @dev extract for reuse emit RewardsChanged event
     */
    function _emitRewardsChangedEvent(
        address indexer,
        uint256 eraNumber,
        RewardInfo storage rewardInfo
    ) private {
        emit RewardsChanged(
            indexer,
            eraNumber,
            rewardInfo.eraRewardAddTable[eraNumber],
            rewardInfo.eraRewardRemoveTable[eraNumber]
        );
    }

    /**
     * @dev Send the commission of the rewards to the indexer directly. Calculate and update
     * the accSQTPerStake of the Indexer.
     * @param indexer Indexer address
     * @param reward Rewards amount
     */
    function distributeRewards(address indexer, uint256 reward) private {
        uint256 commission = MathUtil.mulDiv(commissionRates[indexer], reward, PER_MILL);
        IERC20(settings.getSQToken()).safeTransfer(indexer, commission);

        uint256 totalStake = getTotalStakingAmount(indexer);
        require(totalStake > 0, 'Non-indexer');

        info[indexer].accSQTPerStake += MathUtil.mulDiv(reward - commission, PER_TRILL, totalStake);
    }

    /**
     * @dev Update the totalStakingAmount of the indexer with the state from Staking contract.
     * Called when applyStakeChange or applyICRChange.
     * @param staking Staking contract interface
     * @param indexer Indexer address
     * @param currentEra Current Era number
     */
    function _updateTotalStakingAmount(
        IStaking staking,
        address indexer,
        uint256 currentEra
    ) private {
        bool settled = checkAndReflectSettlement(currentEra, indexer, info[indexer].lastClaimEra);
        if (settled) {
            totalStakingAmount[indexer] = staking.getTotalStakingAmount(indexer);
        }
    }

    /**
     * @dev Split rewards from agreemrnt into Eras:
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
        uint256 firstEraPortion = MathUtil.min(
            eraManager.eraStartTime() + (agreementStartEra - eraManager.eraNumber() + 1) * eraPeriod,
            estAgreementEnd
        ) - agreementStartDate;

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
            rewardInfo.eraRewardAddTable[agreementStartEra + 1] += firstEraReward < lastEraReward
                ? lastEraReward - firstEraReward
                : firstEraReward - lastEraReward;
            rewardInfo.eraRewardRemoveTable[postEndEra] += lastEraReward;

            _emitRewardsChangedEvent(indexer, postEndEra, rewardInfo);
        } else {
            // span in > two eras
            splitEraSpanMore(
                firstEraPortion,
                agreementValue,
                agreementPeriod,
                agreementStartEra,
                eraPeriod,
                rewardInfo
            );

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

    function addInstantRewards(address indexer, address sender, uint256 amount) external {
        IERC20(settings.getSQToken()).safeTransferFrom(sender, address(this), amount);

        IEraManager eraManager = IEraManager(settings.getEraManager());
        uint256 currentEra = eraManager.safeUpdateAndGetEra();

        RewardInfo storage rewardInfo = info[indexer];
        rewardInfo.eraRewardAddTable[currentEra] += amount;
        rewardInfo.eraRewardRemoveTable[currentEra + 1] += amount;

        // Current era will always change
        _emitRewardsChangedEvent(indexer, currentEra, rewardInfo);

        // Next era will always change
        _emitRewardsChangedEvent(indexer, currentEra + 1, rewardInfo);
    }

    /**
     * @dev Handle split rewards into more then two Eras,
     * private method called by increaseAgreementRewards.
     */
    function splitEraSpanMore(
        uint256 firstEraPortion,
        uint256 agreementValue,
        uint256 agreementPeriod,
        uint256 agreementStartEra,
        uint256 eraPeriod,
        RewardInfo storage rewardInfo
    ) private {
        // span in > two eras
        uint256 firstEraReward = MathUtil.mulDiv(firstEraPortion, agreementValue, agreementPeriod);
        rewardInfo.eraRewardAddTable[agreementStartEra] += firstEraReward;
        uint256 restEras = MathUtil.divUp(agreementPeriod - firstEraPortion, eraPeriod);
        uint256 rewardForMidEra = MathUtil.mulDiv(eraPeriod, agreementValue, agreementPeriod);
        rewardInfo.eraRewardAddTable[agreementStartEra + 1] += rewardForMidEra - firstEraReward;
        uint256 rewardForLastEra = MathUtil.sub(
            MathUtil.sub(agreementValue, firstEraReward),
            rewardForMidEra * (restEras - 1)
        );
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
    }

    /**
     * @dev check if the current Era is claimed.
     */
    function collectAndDistributeRewards(address indexer) public {
        // check current era is after lastClaimEra
        uint256 currentEra = _getCurrentEra();
        require(info[indexer].lastClaimEra < currentEra - 1, 'Waiting next era');
        _collectAndDistributeRewards(currentEra, indexer);
    }

    /**
     * @dev collect and distribute rewards with specific indexer and batch size
     */
    // function batchCollectAndDistributeRewards(address indexer, uint256 batchSize) public {
    //     // check current era is after lastClaimEra
    //     uint256 currentEra = _getCurrentEra();
    //     uint256 loopCount = MathUtil.min(batchSize, currentEra - info[indexer].lastClaimEra - 1);
    //     for (uint256 i = 0; i < loopCount; i++) {
    //         _collectAndDistributeRewards(currentEra, indexer);
    //     }
    // }

    /**
     * @dev Calculate and distribute the rewards for the next Era of the lastClaimEra.
     * Calculate by eraRewardAddTable and eraRewardRemoveTable.
     * Distribute by distributeRewards method.
     */
    function _collectAndDistributeRewards(uint256 currentEra, address indexer) public returns (uint256) {
        RewardInfo storage rewardInfo = info[indexer];
        require(rewardInfo.lastClaimEra > 0, 'Invalid indexer');
        // skip when it has been claimed for currentEra - 1, no throws
        if (rewardInfo.lastClaimEra >= currentEra - 1) {
            return rewardInfo.lastClaimEra;
        }
        checkAndReflectSettlement(currentEra, indexer, rewardInfo.lastClaimEra);
        require(rewardInfo.lastClaimEra <= lastSettledEra[indexer], 'Pending stake or ICR');
        rewardInfo.lastClaimEra++;
        rewardInfo.eraReward += rewardInfo.eraRewardAddTable[rewardInfo.lastClaimEra];
        rewardInfo.eraReward -= rewardInfo.eraRewardRemoveTable[rewardInfo.lastClaimEra];
        delete rewardInfo.eraRewardAddTable[rewardInfo.lastClaimEra];
        delete rewardInfo.eraRewardRemoveTable[rewardInfo.lastClaimEra];
        if (rewardInfo.eraReward != 0) {
            distributeRewards(indexer, rewardInfo.eraReward);
            emit DistributeRewards(indexer, currentEra);
        }
        return rewardInfo.lastClaimEra;
    }

    /**
     * @dev Callback method of stake change, called by Staking contract when
     * Indexers or Delegators try to change their stake amount.
     * Update pending stake info stored in contract states with Staking contract,
     * and wait to apply at next Era.
     * New Indexer's first stake change need to apply immediately。
     * Last era's reward need to be collected before this can pass.
     */
    function onStakeChange(address _indexer, address _source) external {
        require(msg.sender == settings.getStaking(), 'Only Staking');
        uint256 currentEra = _getCurrentEra();
        RewardInfo storage rewardInfo = info[_indexer];

        if (totalStakingAmount[_indexer] == 0) {
            rewardInfo.lastClaimEra = currentEra - 1;
            lastSettledEra[_indexer] = currentEra - 1;

            IStaking staking = IStaking(settings.getStaking());
            //apply first onStakeChange
            uint256 newDelegation = staking.getDelegationAmount(_indexer, _indexer);
            delegation[_indexer][_indexer] = newDelegation;

            info[_indexer].rewardDebt[_indexer] = MathUtil.mulDiv(
                newDelegation,
                info[_indexer].accSQTPerStake,
                PER_TRILL
            );
            //make sure the eraReward be 0, when indexer reregister
            if (info[_indexer].eraRewardRemoveTable[currentEra] == 0) {
                info[_indexer].eraReward = 0;
            }
            totalStakingAmount[_indexer] = staking.getTotalStakingAmount(_indexer);

            //apply first onICRChgange
            uint256 newCommissionRate = staking.getCommissionRate(_indexer);
            commissionRates[_indexer] = newCommissionRate;

            emit StakeChanged(_indexer, _indexer, newDelegation);
            emit ICRChanged(_indexer, newCommissionRate);
            emit SettledEraUpdated(_indexer, currentEra - 1);
        } else {
            require(
                _collectAndDistributeRewards(currentEra, _indexer) == currentEra - 1,
                'Unless collect at last era'
            );
            require(
                checkAndReflectSettlement(currentEra, _indexer, rewardInfo.lastClaimEra),
                'Need apply pending'
            );
            if (!_pendingStakeChange(_indexer, _source)) {
                pendingStakers[_indexer][pendingStakeChangeLength[_indexer]] = _source;
                pendingStakerNos[_indexer][_source] = pendingStakeChangeLength[_indexer];
                pendingStakeChangeLength[_indexer]++;
            }
        }
    }

    /**
     * @dev Callback method of stake change, called by Staking contract when
     * Indexers try to change commitionRate.
     * Update commitionRate info stored in contract states with Staking contract,
     * and wait to apply at two Eras later.
     * Last era's reward need to be collected before this can pass.
     */
    function onICRChange(address indexer, uint256 startEra) external {
        require(msg.sender == settings.getStaking(), 'Only Staking');
        uint256 currentEra = _getCurrentEra();
        require(startEra > currentEra, 'Too early');
        require(
            _collectAndDistributeRewards(currentEra, indexer) == currentEra - 1,
            'Unless collect at last era'
        );
        require(
            checkAndReflectSettlement(currentEra, indexer, info[indexer].lastClaimEra),
            'Need apply pending'
        );
        pendingCommissionRateChange[indexer] = startEra;
    }

    /**
     * @dev Apply a list of stakers' StakeChanges, call applyStakeChange one by one.
     */
    // function applyStakeChanges(address indexer, address[] memory stakers) public {
    //     for (uint256 i = 0; i < stakers.length; i++) {
    //         applyStakeChange(indexer, stakers[i]);
    //     }
    // }

    /**
     * @dev Apply the stake change and calaulate the new rewardDebt for staker.
     */
    function applyStakeChange(address indexer, address staker) public {
        uint256 currentEra = _getCurrentEra();
        uint256 lastClaimEra = info[indexer].lastClaimEra;
        require(_pendingStakeChange(indexer, staker), 'No pending');
        require(lastSettledEra[indexer] < lastClaimEra, 'Rewards should be collected');
        IRewardsPool rewardsPool = IRewardsPool(settings.getRewardsPool());
        require(rewardsPool.isClaimed(lastClaimEra, indexer), 'Rewards Pool should be collected');

        _claim(indexer, staker);

        // run hook for delegation change
        IStaking staking = IStaking(settings.getStaking());
        uint256 newDelegation = staking.getDelegationAmount(staker, indexer);
        delegation[staker][indexer] = newDelegation;

        info[indexer].rewardDebt[staker] = MathUtil.mulDiv(newDelegation, info[indexer].accSQTPerStake, PER_TRILL);
        _removePendingStake(indexer, staker);
        _updateTotalStakingAmount(staking, indexer, currentEra);
        emit StakeChanged(indexer, staker, newDelegation);
    }

    /**
     * @dev Apply the CommissionRate change and update the commissionRates stored in contract states.
     */
    function applyICRChange(address indexer) public {
        uint256 currentEra = _getCurrentEra();
        require(
            pendingCommissionRateChange[indexer] != 0 && pendingCommissionRateChange[indexer] <= currentEra,
            'No pending'
        );

        require(lastSettledEra[indexer] < info[indexer].lastClaimEra, 'Rewards should be collected');

        IStaking staking = IStaking(settings.getStaking());
        uint256 newCommissionRate = staking.getCommissionRate(indexer);
        commissionRates[indexer] = newCommissionRate;
        pendingCommissionRateChange[indexer] = 0;
        _updateTotalStakingAmount(staking, indexer, currentEra);
        emit ICRChanged(indexer, newCommissionRate);
    }

    /**
     * @dev Claim rewards of msg.sender for specific indexer.
     */
    function claim(address indexer) public {
        require(_claim(indexer, msg.sender) > 0, 'No rewards');
    }

    /**
     * @dev Claculate the Rewards for user and tranfrer token to user.
     */
    function _claim(address indexer, address user) public returns (uint256) {
        uint256 rewards = userRewards(indexer, user);
        if (rewards == 0) return 0;
        IERC20(settings.getSQToken()).safeTransfer(user, rewards);
        info[indexer].rewardDebt[user] += rewards;
        emit ClaimRewards(indexer, user, rewards);
        return rewards;
    }

    /**
     * @dev Use F1 Fee Distribution to calculate user rewards.
     */
    function userRewards(address indexer, address user) public view returns (uint256) {
        uint256 delegationAmount = this.getDelegationAmount(user, indexer);
        return
            MathUtil.mulDiv(delegationAmount, info[indexer].accSQTPerStake, PER_TRILL) - info[indexer].rewardDebt[user];
    }

    /**
     * @dev Check if the previous Era has been settled, also update lastSettledEra.
     * Require to be true when someone try to claimRewards() or onStakeChangeRequested().
     */
    function checkAndReflectSettlement(
        uint256 currentEra,
        address indexer,
        uint256 lastClaimEra
    ) private returns (bool) {
        if (lastSettledEra[indexer] == currentEra - 1) {
            return true;
        }
        if (pendingStakeChangeLength[indexer] == 0 && pendingCommissionRateChange[indexer] == 0) {
            lastSettledEra[indexer] = currentEra - 1;
            emit SettledEraUpdated(indexer, currentEra - 1);
            return true;
        }
        if (pendingStakeChangeLength[indexer] == 0 && pendingCommissionRateChange[indexer] - 1 > lastClaimEra) {
            lastSettledEra[indexer] = lastClaimEra;
            emit SettledEraUpdated(indexer, lastClaimEra);
            return true;
        }
        return false;
    }

    /**
     * @dev Get current Era number from EraManager.
     */
    function _getCurrentEra() private returns (uint256) {
        IEraManager eraManager = IEraManager(settings.getEraManager());
        return eraManager.safeUpdateAndGetEra();
    }

    /**
     * @dev Check whether the indexer has pending stake changes for the staker.
     */
    function _pendingStakeChange(address _indexer, address _staker) private view returns (bool) {
        return pendingStakers[_indexer][pendingStakerNos[_indexer][_staker]] == _staker;
    }

    /**
     * @dev Remove the pending stake change of the staker.
     */
    function _removePendingStake(address _indexer, address _staker) private {
        uint256 stakerIndex = pendingStakerNos[_indexer][_staker];
        pendingStakers[_indexer][stakerIndex] = address(0x00);

        address lastStaker = pendingStakers[_indexer][pendingStakeChangeLength[_indexer] - 1];
        pendingStakers[_indexer][stakerIndex] = lastStaker;
        pendingStakerNos[_indexer][lastStaker] = stakerIndex;
        pendingStakeChangeLength[_indexer]--;
    }

    // -- Views --
    // Reward info for query.
    struct IndexerRewardInfo {
        uint256 accSQTPerStake;
        uint256 lastClaimEra;
        uint256 eraReward;
    }

    function getRewardInfo(address indexer) public view returns (IndexerRewardInfo memory) {
        RewardInfo storage reward = info[indexer];
        return IndexerRewardInfo(reward.accSQTPerStake, reward.lastClaimEra, reward.eraReward);
    }

    function getLastSettledEra(address indexer) public view returns (uint256) {
        return lastSettledEra[indexer];
    }

    function getCommissionRateChangedEra(address indexer) public view returns (uint256) {
        return pendingCommissionRateChange[indexer];
    }

    function getPendingStakers(address indexer) public view returns (address[] memory) {
        address[] memory _stakers = new address[](pendingStakeChangeLength[indexer]);
        for (uint256 i = 0; i < pendingStakeChangeLength[indexer]; i++) {
            _stakers[i] = pendingStakers[indexer][i];
        }

        return _stakers;
    }

    function getTotalStakingAmount(address _indexer) public view returns (uint256) {
        return totalStakingAmount[_indexer];
    }

    function getDelegationAmount(address _source, address _indexer) public view returns (uint256) {
        return delegation[_source][_indexer];
    }

    function getRewardsAddTable(
        address indexer,
        uint256 startEra,
        uint256 length
    ) public view returns (uint256[] memory) {
        uint256[] memory table = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            table[i] = info[indexer].eraRewardAddTable[i + startEra];
        }
        return table;
    }

    function getRewardsRemoveTable(
        address indexer,
        uint256 startEra,
        uint256 length
    ) public view returns (uint256[] memory) {
        uint256[] memory table = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            table[i] = info[indexer].eraRewardRemoveTable[i + startEra];
        }
        return table;
    }
}
