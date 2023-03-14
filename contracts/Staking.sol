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
import './interfaces/IRewardsStaking.sol';
import './interfaces/ISQToken.sol';
import './interfaces/IDisputeManager.sol';
import './Constants.sol';
import './utils/MathUtil.sol';

/**
 * @title Staking Contract
 * @notice ### Overview
 * The Staking contract hold and track the changes of all staked SQT Token, It provides entry for the indexers and delegators to
 * stake/unstake, delegate/undelegate to available Indexers and withdraw their SQT Token. It also track the changes of the commission rate of each
 * Indexer and make these changes always applied at two Eras later. We design this to allow time for the delegators
 * to consider their delegation when an Indxer changes the commission rate.
 *
 * ## Terminology
 * stake -- Indexers must stake SQT Token to themself and not less than the minimumStakingAmount we set in IndexerRegistry contract
 * delegate -- Delegators can delegate SQT Token to any indexer to share Indexer‘s Rewards.
 * total staked amount -- indexer's stake amount + total delegate amount.
 * The Indexer staked amount effects its max acceptable delegation amount.
 * The total staked amount of an Indexer effects the maximum reward it can earn in an Era.
 *
 * ## Detail
 * Since The change of stake or delegate amount and commission rate affects the rewards distribution. So when
 * users make these changes, we call onStakeChange()/onICRChnage() from rewardsStaking/rewardsPool contract to notify it to
 * apply these changes for future distribution.
 * In our design rewardsStaking contract apply the first stake change and commission rate change immediately when
 * an Indexer make registration. Later on all the stake change apply at next Era, commission rate apply at two Eras later.
 *
 * Since Indexers need to stake SQT Token at registration and the staked amount effects its max acceptable delegation amount.
 * So the implementation of stake() is diffrernt with delegate().
 * - stake() is for Indexers to stake on themself. There has no stake amount limitation.
 * - delegate() is for delegators to delegate on an indexer and need to consider the indexer's delegation limitation.
 *
 * Also in this contarct we has two entries to set commission rate for indexers.
 * setInitialCommissionRate() is called by IndexrRegister contract when indexer register, this change need to take effect immediately.
 * setCommissionRate() is called by Indexers to set their commission rate, and will be take effect after two Eras.
 *
 * Since Indexer must keep the minimumStakingAmount, so the implementation of unstake() also different with undelegate().
 * - unstake() is for Indexers to unstake their staking token. An indexer can not unstake all the token unless the indexer unregister from the network.
 * Indexer need to keep the minimumStakingAmount staked on itself when it unstake.
 * - undelegate() is for delegator to undelegate from an Indexer can be called by Delegators.
 * Delegators can undelegate all their delegated tokens at one time.
 * Tokens will transfer to user's account after the lockPeriod when users apply withdraw.
 * Every widthdraw will cost a fix rate fees(unbondFeeRate), and these fees will be burned.
 */
contract Staking is IStaking, Initializable, OwnableUpgradeable, Constants {
    using SafeERC20 for IERC20;
    using MathUtil for uint256;

    // -- Storage --

    ISettings public settings;

    /**
     * The ratio of total stake amount to indexer self stake amount to limit the
     * total delegation amount. Initial value is set to 10, which means the total
     * stake amount cannot exceed 10 times the indexer self stake amount.
     */
    uint256 public indexerLeverageLimit;

    // The rate of token burn when withdraw.
    uint256 public unbondFeeRate;

    // Lock period for withdraw, timestamp unit
    uint256 public lockPeriod;

    // Number of registered indexers.
    uint256 public indexerLength;

    // Max length of unbonding rewards
    uint256 public maxUnbondingRewards;

    // Max length of unbonding staking
    uint256 public maxUnbondingStaking;

    // Staking address by indexer number.
    mapping(uint256 => address) public indexers;

    // Indexer number by staking address.
    mapping(address => uint256) public indexerNo;

    // Staking amount per indexer address.
    mapping(address => StakingAmount) public totalStakingAmount;

    // Unbonding amount, address -> Unbonding
    mapping(address => Unbonding) public unbondings;

    // Active delegation from delegator to indexer, delegator->indexer->amount
    mapping(address => mapping(address => StakingAmount)) public delegation;

    // Each delegator total locked amount, delegator->amount
    // LockedAmount include stakedAmount + amount in locked period
    mapping(address => uint256) public lockedAmount;

    // Actively staking indexers by delegator
    mapping(address => mapping(uint256 => address)) public stakingIndexers;

    // Delegating indexer number by delegator and indexer
    mapping(address => mapping(address => uint256)) public stakingIndexerNos;

    // Staking indexer lengths
    mapping(address => uint256) public stakingIndexerLengths;

    // -- Events --

    /**
     * @dev Emitted when stake to an Indexer.
     */
    event DelegationAdded(address indexed source, address indexed indexer, uint256 amount);

    /**
     * @dev Emitted when unstake to an Indexer.
     */
    event DelegationRemoved(address indexed source, address indexed indexer, uint256 amount);

    /**
     * @dev Emitted when request unbond.
     */
    event UnbondingRequested(address indexed source, address indexed indexer, uint256 amount, UnbondingType _type, uint256 index);

    /**
     * @dev Emitted when request withdraw.
     */
    event UnbondingWithdrawn(address indexed source, uint256 amount, UnbondingType _type, uint256 index);

    /**
     * @dev Emitted when delegtor cancel unbond request.
     */
    event UnbondingCancelled(address indexed source, UnbondingType _type, uint256 index);

    modifier onlyStakingManager() {
        require(msg.sender == settings.getStakingManager(), 'G007');
        _;
    }

    // -- Functions --

    /**
     * @dev Initialize this contract.
     */
    function initialize(uint256 _lockPeriod, ISettings _settings) external initializer {
        __Ownable_init();

        indexerLeverageLimit = 10;
        unbondFeeRate = 1e3;

        maxUnbondingRewards = 5;
        maxUnbondingStaking = 15;

        lockPeriod = _lockPeriod;
        settings = _settings;
    }

    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    function setLockPeriod(uint256 _lockPeriod) external onlyOwner {
        lockPeriod = _lockPeriod;
    }

    function setIndexerLeverageLimit(uint256 _indexerLeverageLimit) external onlyOwner {
        indexerLeverageLimit = _indexerLeverageLimit;
    }

    function setUnbondingFeeRateBP(uint256 _unbondFeeRate) external onlyOwner {
        require(_unbondFeeRate < PER_MILL, 'S001');
        unbondFeeRate = _unbondFeeRate;
    }

    function setMaxUnbonding(uint256 rewards, uint256 staking) external onlyOwner {
        maxUnbondingRewards = rewards;
        maxUnbondingStaking = staking;
    }

    /**
     * @dev when Era update if valueAfter is the effective value, swap it to valueAt,
     * so later on we can update valueAfter without change current value
     * require it idempotent.
     */
    function reflectEraUpdate(address _source, address _indexer) public {
        uint256 eraNumber = IEraManager(settings.getEraManager()).safeUpdateAndGetEra();
        _reflectStakingAmount(eraNumber, delegation[_source][_indexer]);
        _reflectStakingAmount(eraNumber, totalStakingAmount[_indexer]);
    }

    function _reflectStakingAmount(uint256 eraNumber, StakingAmount storage stakeAmount) private {
        if (stakeAmount.era < eraNumber) {
            stakeAmount.era = eraNumber;
            stakeAmount.valueAt = stakeAmount.valueAfter;
        }
    }

    function checkDelegateLimitation(address _indexer, uint256 _amount) external view onlyStakingManager {
        require(
            delegation[_indexer][_indexer].valueAfter * indexerLeverageLimit >=
                totalStakingAmount[_indexer].valueAfter + _amount,
            'S002'
        );
    }

    function addIndexer(address _indexer) external onlyStakingManager {
        indexers[indexerLength] = _indexer;
        indexerNo[_indexer] = indexerLength;
        indexerLength++;
    }

    function removeIndexer(address _indexer) external onlyStakingManager {
        indexers[indexerNo[_indexer]] = indexers[indexerLength - 1];
        indexerNo[indexers[indexerLength - 1]] = indexerNo[_indexer];
        indexerLength--;
    }

    function removeUnbondingAmount(address _source, UnbondingType _type, uint256 _index) external onlyStakingManager {
        Unbonding storage unbonding = unbondings[_source];

        if (_type != UnbondingType.Commission) {
            delete unbonding.staking[_index];
            if (_index == unbonding.stakingStart) {
                unbonding.stakingStart ++;
            }
            if (_index == unbonding.stakingNext - 1) {
                unbonding.stakingNext --;
            }
        } else {
            delete unbonding.rewards[_index];
            if (_index == unbonding.rewardsStart) {
                unbonding.rewardsStart ++;
            }
            if (_index == unbonding.rewardsNext - 1) {
                unbonding.rewardsNext --;
            }
        }

        emit UnbondingCancelled(_source, _type, _index);
    }

    function addDelegation(
        address _source,
        address _indexer,
        uint256 _amount
    ) external {
        require(msg.sender == settings.getStakingManager() || msg.sender == address(this), 'G008');
        require(_amount > 0, 'S003');
        if (this.isEmptyDelegation(_source, _indexer)) {
            stakingIndexerNos[_source][_indexer] = stakingIndexerLengths[_source];
            stakingIndexers[_source][stakingIndexerLengths[_source]] = _indexer;
            stakingIndexerLengths[_source]++;
        }
        // first stake from indexer
        bool firstStake = this.isEmptyDelegation(_indexer, _indexer) &&
            totalStakingAmount[_indexer].valueAt == 0 &&
            totalStakingAmount[_indexer].valueAfter == 0;
        if (firstStake) {
            require(_source == _indexer, 'S004');
            delegation[_source][_indexer].valueAt = _amount;
            totalStakingAmount[_indexer].valueAt = _amount;
            delegation[_source][_indexer].valueAfter = _amount;
            totalStakingAmount[_indexer].valueAfter = _amount;
        } else {
            delegation[_source][_indexer].valueAfter += _amount;
            totalStakingAmount[_indexer].valueAfter += _amount;
        }
        lockedAmount[_source] += _amount;
        _onDelegationChange(_source, _indexer);

        emit DelegationAdded(_source, _indexer, _amount);
    }

    function delegateToIndexer(
        address _source,
        address _indexer,
        uint256 _amount
    ) external onlyStakingManager {
        IERC20(settings.getSQToken()).safeTransferFrom(_source, address(this), _amount);

        this.addDelegation(_source, _indexer, _amount);
    }

    function removeDelegation(
        address _source,
        address _indexer,
        uint256 _amount
    ) external {
        require(msg.sender == settings.getStakingManager() || msg.sender == address(this), 'G008');
        require(delegation[_source][_indexer].valueAfter >= _amount && _amount > 0, 'S005');

        delegation[_source][_indexer].valueAfter -= _amount;
        totalStakingAmount[_indexer].valueAfter -= _amount;

        _onDelegationChange(_source, _indexer);

        emit DelegationRemoved(_source, _indexer, _amount);
    }

    /**
     * @dev When the delegation change nodify rewardsStaking to deal with the change.
     */
    function _onDelegationChange(address _source, address _indexer) internal {
        IRewardsStaking rewardsStaking = IRewardsStaking(settings.getRewardsStaking());
        rewardsStaking.onStakeChange(_indexer, _source);
    }

    function startUnbonding(
        address _source,
        address _indexer,
        uint256 _amount,
        UnbondingType _type
    ) external {
        require(msg.sender == settings.getStakingManager() || msg.sender == address(this), 'G008');
        Unbonding storage unbonding = unbondings[_indexer];

        uint256 _index;
        UnbondingAmount storage ua;
        if (_type != UnbondingType.Commission) {
            this.removeDelegation(_source, _indexer, _amount);
            require(unbonding.stakingNext - unbonding.stakingStart < maxUnbondingStaking, 'S006');

            // Add new unbonding staking amount
            _index = unbonding.stakingNext;
            ua = unbonding.staking[_index];
            unbonding.stakingNext ++;
        } else {
            _index = unbonding.rewardsNext;
            if (unbonding.rewardsStart + maxUnbondingRewards == unbonding.rewardsNext) {
                // Append to last unbonding rewards amount
                _index = unbonding.rewardsNext --;
            }

            ua = unbonding.rewards[_index];
            unbonding.rewardsNext ++;
        }

        ua.amount += _amount;
        ua.startTime = block.timestamp;
        ua.indexer = _indexer;

        emit UnbondingRequested(_source, ua.indexer, ua.amount, _type, _index);
    }

    /**
     * @dev Withdraw a single request.
     * burn the withdrawn fees and transfer the rest to delegator.
     */
    function withdrawARequest(address _source, UnbondingType _type, uint256 _index) external onlyStakingManager {
        Unbonding storage unbonding = unbondings[_source];

        UnbondingAmount storage ua;
        if (_type != UnbondingType.Commission) {
            ua = unbonding.staking[_index];
            unbonding.stakingStart ++;
        } else {
            ua = unbonding.rewards[_index];
            unbonding.rewardsStart ++;
        }

        if (ua.amount > 0) {
            // burn specific percentage
            uint256 burnAmount = MathUtil.mulDiv(unbondFeeRate, ua.amount, PER_MILL);
            uint256 availableAmount = ua.amount - burnAmount;

            address SQToken = settings.getSQToken();
            ISQToken(SQToken).burn(burnAmount);
            IERC20(SQToken).safeTransfer(_source, availableAmount);

            lockedAmount[_source] -= ua.amount;

            emit UnbondingWithdrawn(_source, availableAmount, _type, _index);
        }
    }

    function slashIndexer(address _indexer, uint256 _amount) external onlyStakingManager {
        uint256 amount = _amount;
        Unbonding storage unbonding = unbondings[_indexer];

        for (uint256 i = unbonding.rewardsStart; i < unbonding.rewardsNext; i++) {
            if (amount > unbonding.rewards[i].amount) {
                amount -= unbonding.rewards[i].amount;
                delete unbonding.rewards[i];
                unbonding.rewardsStart ++;
            } else if (amount == unbonding.rewards[i].amount) {
                amount = 0;
                delete unbonding.rewards[i];
                unbonding.rewardsStart ++;
                break;
            } else {
                amount = 0;
                unbonding.rewards[i].amount -= amount;
                break;
            }
        }

        for (uint256 i = unbonding.stakingStart; i < unbonding.stakingNext; i++) {
            if (amount > unbonding.staking[i].amount) {
                amount -= unbonding.staking[i].amount;
                delete unbonding.staking[i];
                unbonding.stakingStart ++;
            } else if (amount == unbonding.staking[i].amount) {
                amount = 0;
                delete unbonding.staking[i];
                unbonding.stakingStart ++;
                break;
            } else {
                amount = 0;
                unbonding.staking[i].amount -= amount;
                break;
            }
        }

        if (amount > 0) {
            delegation[_indexer][_indexer].valueAt -= amount;
            totalStakingAmount[_indexer].valueAt -= amount;
            delegation[_indexer][_indexer].valueAfter -= amount;
            totalStakingAmount[_indexer].valueAfter -= amount;
        }

        IERC20(settings.getSQToken()).safeTransfer(settings.getDisputeManager(), _amount);
    }

    function unbondCommission(address _indexer, uint256 _amount) external {
        require(msg.sender == settings.getRewardsDistributer(), 'G003');
        lockedAmount[_indexer] += _amount;
        this.startUnbonding(_indexer, _indexer, _amount, UnbondingType.Commission);
    }

    // -- Views --

    function isEmptyDelegation(address _source, address _indexer) external view returns (bool) {
        return delegation[_source][_indexer].valueAt == 0 && delegation[_source][_indexer].valueAfter == 0;
    }

    function unbondingLength(address indexer) external view returns (uint256,uint256,uint256,uint256) {
        Unbonding storage unbond = unbondings[indexer];
        return (unbond.rewardsStart, unbond.rewardsNext, unbond.stakingStart, unbond.stakingNext);
    }

    function unbondingAmount(address indexer, UnbondingType _type, uint256 index) external view returns (UnbondingAmount memory) {
        if (_type != UnbondingType.Commission) {
            return unbondings[indexer].staking[index];
        } else {
            return unbondings[indexer].rewards[index];
        }
    }
}
