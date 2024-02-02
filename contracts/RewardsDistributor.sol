// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/ISettings.sol';
import './interfaces/IEraManager.sol';
import './interfaces/IPermissionedExchange.sol';
import './interfaces/IRewardsDistributor.sol';
import './interfaces/IRewardsPool.sol';
import './interfaces/IRewardsStaking.sol';
import './interfaces/IServiceAgreementRegistry.sol';
import './interfaces/IIndexerRegistry.sol';
import './interfaces/IStaking.sol';
import './interfaces/IStakingManager.sol';
import './Constants.sol';
import './utils/MathUtil.sol';

/**
 * @title Rewards Distributer Contract
 * @notice ### Overview
 * The Rewards distributer contract tracks and distriubtes the rewards Era by Era.
 * In each distribution, Runners can take the commission part of rewards, the remaining
 * rewards are distributed according to the staking amount of runners and delegators.
 *
 * ### Terminology
 * Era -- Era is the period of reward distribution. In our design, we must distribute the rewards of the previous Era
 * before we can move to the next Era.
 * Runner -- is used to called Runner, they refer to same role in the network.
 * Commission Rate -- Commission Rates are set by Runners, it is the proportion to be taken by the runner in each
 * reward distribution.
 * Rewards -- All the rewards are temporary hold by RewardsDistributor contract and distribute to Runners and Delegator Era by Era.
 *
 * ### Detail
 * This contract manages the rewards of runner pool for each era, there are two ways rewards can arrive to runner's reward pool
 * - addInstantRewards: rewards add to current era's runner reward pool. it can be State Channel Rewards or Allocation Rewards
 * - increaseAgreementRewards: rewards add to current and future era's runner reward pool, base on the period of agreement.
 *
 * To avoid loop in splitting agreement rewards, we use add table and remove table to track the change of rewards for each era.
 * So theoretically, depends on the length of agreement period, there are 4 possibilities how add table and remove table
 * - eraN: add, eraN+1: remove - when agreement lives within 1 era
 * - eraN: add, eraN+1: remove, eraN+2: remove - when agreement lives within 2 era, first era's reward is larger
 * - eraN: add, eraN+1: add, eraN+2: remove - when agreement lives within 2 era, second era's reward is larger
 * - eraN: add, eraN+1: add, eraM: remove, eraM+: remove - when agreement lives across more than 2 eras
 * The most important principle is, after the change with rewards add and remove, in the end without new arrival rewards,
 * era rewards should return to 0, otherwise we introduce imbalance.
 *
 * The stake changes are always hold until new era starts, so we need to sync stake changes from Staking Contract,
 * this is done in RewardsStaking contract, which is splitted from this contract originally. Check there for more details.
 *
 * Runner's commission is treated as unbond request to Staking Contract, which applies a lock period on it.
 */
contract RewardsDistributor is IRewardsDistributor, Initializable, OwnableUpgradeable {
    using SafeERC20 for IERC20;
    using MathUtil for uint256;

    /**
     * @notice Reward information. One per Runner.
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
    ISettings public settings;
    /// @notice Reward information: runner => RewardInfo
    mapping(address => RewardInfo) private info;

    /// @dev ### EVENTS
    /// @notice Emitted when rewards are distributed for the earliest pending distributed Era.
    event DistributeRewards(
        address indexed runner,
        uint256 indexed eraIdx,
        uint256 rewards,
        uint256 commission
    );
    /// @notice Emitted when user claimed rewards.
    event ClaimRewards(address indexed runner, address indexed delegator, uint256 rewards);
    /// @notice Emitted when the rewards change, such as when rewards coming from new agreement.
    event RewardsChanged(
        address indexed runner,
        uint256 indexed eraIdx,
        uint256 additions,
        uint256 removals
    );
    /// @notice Emitted when rewards arrive via addInstantRewards()
    event InstantRewards(address indexed runner, uint256 indexed eraIdx, uint256 token);
    /// @notice Emitted when rewards arrive via increaseAgreementRewards()
    event AgreementRewards(address indexed runner, uint256 agreementId, uint256 token);

    modifier onlyRewardsStaking() {
        require(msg.sender == settings.getContractAddress(SQContracts.RewardsStaking), 'G014');
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
     * @notice Initialize the runner first last claim era.
     * Only RewardsStaking can call.
     * @param runner address
     * @param era uint256
     */
    function setLastClaimEra(address runner, uint256 era) external onlyRewardsStaking {
        info[runner].lastClaimEra = era;
    }

    /**
     * @notice Update delegator debt in rewards.
     * Only RewardsStaking can call.
     * @param runner address
     * @param delegator address
     * @param amount uint256
     */
    function setRewardDebt(
        address runner,
        address delegator,
        uint256 amount
    ) external onlyRewardsStaking {
        info[runner].rewardDebt[delegator] = amount;
    }

    /**
     * @notice Reset era reward.
     * Only RewardsStaking can call.
     * @param runner address
     * @param era uint256
     */
    function resetEraReward(address runner, uint256 era) external onlyRewardsStaking {
        if (info[runner].eraRewardRemoveTable[era] == 0) {
            info[runner].eraReward = 0;
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
        require(
            settings.getContractAddress(SQContracts.ServiceAgreementRegistry) == msg.sender,
            'G015'
        );
        ClosedServiceAgreementInfo memory agreement = IServiceAgreementRegistry(
            settings.getContractAddress(SQContracts.ServiceAgreementRegistry)
        ).getClosedServiceAgreement(agreementId);
        require(agreement.consumer != address(0), 'SA001');
        IEraManager eraManager = IEraManager(settings.getContractAddress(SQContracts.EraManager));

        address runner = agreement.indexer;
        uint256 agreementPeriod = agreement.period;
        uint256 agreementValue = agreement.lockedAmount;
        uint256 agreementStartDate = agreement.startDate;
        uint256 agreementStartEra = eraManager.timestampToEraNumber(agreementStartDate);
        uint256 eraPeriod = eraManager.eraPeriod();

        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransferFrom(
            msg.sender,
            address(this),
            agreementValue
        );

        uint256 estAgreementEnd = agreementStartDate + agreementPeriod;
        uint256 firstEraPortion = MathUtil.min(
            eraManager.eraStartTime() +
            (agreementStartEra - eraManager.eraNumber() + 1) *
            eraPeriod,
            estAgreementEnd
        ) - agreementStartDate;

        RewardInfo storage rewardInfo = info[runner];

        if (firstEraPortion == agreementPeriod) {
            // span in one era
            rewardInfo.eraRewardAddTable[agreementStartEra] += agreementValue;
            rewardInfo.eraRewardRemoveTable[agreementStartEra + 1] += agreementValue;
        } else if (agreementPeriod <= eraPeriod + firstEraPortion) {
            // span in two era
            uint256 firstEraReward = MathUtil.mulDiv(
                firstEraPortion,
                agreementValue,
                agreementPeriod
            );
            uint256 lastEraReward = MathUtil.sub(agreementValue, firstEraReward);
            rewardInfo.eraRewardAddTable[agreementStartEra] += firstEraReward;
            rewardInfo.eraRewardRemoveTable[agreementStartEra + 1] += firstEraReward;

            rewardInfo.eraRewardAddTable[agreementStartEra + 1] += lastEraReward;
            rewardInfo.eraRewardRemoveTable[agreementStartEra + 2] += lastEraReward;

            _emitRewardsChangedEvent(runner, agreementStartEra + 2, rewardInfo);
        } else {
            // span in > two eras
            uint256 firstEraReward = MathUtil.mulDiv(
                firstEraPortion,
                agreementValue,
                agreementPeriod
            );
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
                rewardInfo.eraRewardRemoveTable[
                restEras + agreementStartEra + 1
                ] += rewardForLastEra;
            } else {
                // this could happen due to rounding that rewardForLastEra is one larger than rewardForMidEra
                uint256 rewardAdd = MathUtil.sub(rewardForLastEra, rewardForMidEra);
                rewardInfo.eraRewardAddTable[restEras + agreementStartEra] += rewardAdd;
                rewardInfo.eraRewardRemoveTable[
                restEras + agreementStartEra + 1
                ] += rewardForLastEra;
            }

            uint256 lastEra = MathUtil.divUp(agreementPeriod - firstEraPortion, eraPeriod) +
                        agreementStartEra;
            // Last era
            _emitRewardsChangedEvent(runner, lastEra, rewardInfo);

            // Post last era
            _emitRewardsChangedEvent(runner, lastEra + 1, rewardInfo);
        }

        // Current era will always change
        _emitRewardsChangedEvent(runner, agreementStartEra, rewardInfo);

        // Next era will always change
        _emitRewardsChangedEvent(runner, agreementStartEra + 1, rewardInfo);

        emit AgreementRewards(runner, agreementId, agreementValue);
    }

    /**
     * @notice Send rewards directly to the specified era.
     * Maybe RewardsPool call or others contracts.
     * @param runner address
     * @param sender address
     * @param amount uint256
     * @param era uint256
     */
    function addInstantRewards(
        address runner,
        address sender,
        uint256 amount,
        uint256 era
    ) external {
        require(era <= _getCurrentEra(), 'RD001');
        require(era >= info[runner].lastClaimEra, 'RD002');
        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransferFrom(
            sender,
            address(this),
            amount
        );

        RewardInfo storage rewardInfo = info[runner];
        rewardInfo.eraRewardAddTable[era] += amount;
        rewardInfo.eraRewardRemoveTable[era + 1] += amount;

        emit InstantRewards(runner, era, amount);

        // Current era will always change
        _emitRewardsChangedEvent(runner, era, rewardInfo);

        // Next era will always change
        _emitRewardsChangedEvent(runner, era + 1, rewardInfo);
    }

    /**
     * @notice check if the current Era is claimed.
     */
    function collectAndDistributeRewards(address runner) public {
        // check current era is after lastClaimEra
        uint256 currentEra = _getCurrentEra();
        require(info[runner].lastClaimEra < currentEra - 1, 'RD003');
        collectAndDistributeEraRewards(currentEra, runner);
    }

    /**
     * @notice Calculate and distribute the rewards for the next Era of the lastClaimEra.
     * Calculate by eraRewardAddTable and eraRewardRemoveTable.
     * Distribute by distributeRewards method.
     */
    function collectAndDistributeEraRewards(
        uint256 currentEra,
        address runner
    ) public returns (uint256) {
        RewardInfo storage rewardInfo = info[runner];
        require(rewardInfo.lastClaimEra > 0, 'RD004');
        // skip when it has been claimed for currentEra - 1, no throws
        if (rewardInfo.lastClaimEra >= currentEra - 1) {
            return rewardInfo.lastClaimEra;
        }

        IRewardsStaking rewardsStaking = IRewardsStaking(
            settings.getContractAddress(SQContracts.RewardsStaking)
        );
        rewardsStaking.checkAndReflectSettlement(runner, rewardInfo.lastClaimEra);
        require(rewardInfo.lastClaimEra <= rewardsStaking.getLastSettledEra(runner), 'RD005');

        rewardInfo.lastClaimEra++;

        // claim rewards pool.
        IRewardsPool rewardsPool = IRewardsPool(
            settings.getContractAddress(SQContracts.RewardsPool)
        );
        rewardsPool.batchCollectEra(rewardInfo.lastClaimEra, runner);

        rewardInfo.eraReward += rewardInfo.eraRewardAddTable[rewardInfo.lastClaimEra];
        rewardInfo.eraReward -= rewardInfo.eraRewardRemoveTable[rewardInfo.lastClaimEra];
        delete rewardInfo.eraRewardAddTable[rewardInfo.lastClaimEra];
        delete rewardInfo.eraRewardRemoveTable[rewardInfo.lastClaimEra];
        if (rewardInfo.eraReward != 0) {
            uint256 totalStake = rewardsStaking.getTotalStakingAmount(runner);
            require(totalStake > 0, 'RD006');

            uint256 commissionRate = IIndexerRegistry(
                settings.getContractAddress(SQContracts.IndexerRegistry)
            ).getCommissionRate(runner);
            uint256 commission = MathUtil.mulDiv(commissionRate, rewardInfo.eraReward, PER_MILL);

            info[runner].accSQTPerStake += MathUtil.mulDiv(
                rewardInfo.eraReward - commission,
                PER_TRILL,
                totalStake
            );
            if (commission > 0) {
                // add commission to unbonding request
                IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransfer(
                    settings.getContractAddress(SQContracts.Staking),
                    commission
                );
                IStaking(settings.getContractAddress(SQContracts.Staking)).unbondCommission(
                    runner,
                    commission
                );
            }

            emit DistributeRewards(
                runner,
                rewardInfo.lastClaimEra,
                rewardInfo.eraReward,
                commission
            );
        }
        return rewardInfo.lastClaimEra;
    }

    /**
     * @notice Claim rewards of msg.sender for specific runner.
     */
    function claim(address runner) public {
        require(claimFrom(runner, msg.sender) > 0, 'RD007');
    }

    /**
     * @notice Claculate the Rewards for user and tranfrer token to user.
     */
    function claimFrom(address runner, address user) public returns (uint256) {
        require(
            !(IEraManager(settings.getContractAddress(SQContracts.EraManager)).maintenance()),
            'G019'
        );
        uint256 rewards = userRewards(runner, user);
        if (rewards == 0) return 0;
        info[runner].rewardDebt[user] += rewards;

        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransfer(user, rewards);

        emit ClaimRewards(runner, user, rewards);
        return rewards;
    }

    /**
     * @notice extract for reuse emit RewardsChanged event
     */
    function _emitRewardsChangedEvent(
        address runner,
        uint256 eraNumber,
        RewardInfo storage rewardInfo
    ) private {
        emit RewardsChanged(
            runner,
            eraNumber,
            rewardInfo.eraRewardAddTable[eraNumber],
            rewardInfo.eraRewardRemoveTable[eraNumber]
        );
    }

    /**
     * @notice Get current Era number from EraManager.
     */
    function _getCurrentEra() private returns (uint256) {
        IEraManager eraManager = IEraManager(settings.getContractAddress(SQContracts.EraManager));
        return eraManager.safeUpdateAndGetEra();
    }

    function userRewards(address runner, address user) public view returns (uint256) {
        IRewardsStaking rewardsStaking = IRewardsStaking(
            settings.getContractAddress(SQContracts.RewardsStaking)
        );
        uint256 delegationAmount = rewardsStaking.getDelegationAmount(user, runner);

        return
            MathUtil.mulDiv(delegationAmount, info[runner].accSQTPerStake, PER_TRILL) -
            info[runner].rewardDebt[user];
    }

    function getRewardInfo(address runner) public view returns (IndexerRewardInfo memory) {
        RewardInfo storage reward = info[runner];
        return IndexerRewardInfo(reward.accSQTPerStake, reward.lastClaimEra, reward.eraReward);
    }

    function getRewardAddTable(address runner, uint256 era) public view returns (uint256) {
        return info[runner].eraRewardAddTable[era];
    }

    function getRewardRemoveTable(address runner, uint256 era) public view returns (uint256) {
        return info[runner].eraRewardRemoveTable[era];
    }

    function getRewardDebt(address runner, address user) public view returns (uint256) {
        return info[runner].rewardDebt[user];
    }
}
