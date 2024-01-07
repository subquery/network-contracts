// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
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
contract Staking is IStaking, Initializable, OwnableUpgradeable {
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

    // Max limit of unbonding requests
    uint256 public maxUnbondingRequest;

    // Staking address by indexer number.
    mapping(uint256 => address) public indexers;

    // Indexer number by staking address.
    mapping(address => uint256) public indexerNo;

    // Staking amount per indexer address.
    mapping(address => StakingAmount) public totalStakingAmount;

    // Delegator address -> unbond request index -> amount&startTime
    mapping(address => mapping(uint256 => UnbondAmount)) public unbondingAmount;

    // Delegator address -> length of unbond requests
    mapping(address => uint256) public unbondingLength;

    // Delegator address -> length of widthdrawn requests
    mapping(address => uint256) public withdrawnLength;

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
    event UnbondRequested(address indexed source, address indexed indexer, uint256 amount, uint256 index, UnbondType _type);

    /**
     * @dev Emitted when request withdraw.
     */
    event UnbondWithdrawn(address indexed source, uint256 amount, uint256 fee, uint256 index);

    /**
     * @dev Emitted when delegtor cancel unbond request.
     */
    event UnbondCancelled(address indexed source, address indexed indexer, uint256 amount, uint256 index);

    modifier onlyStakingManager() {
        require(msg.sender == settings.getContractAddress(SQContracts.StakingManager), 'G007');
        _;
    }

    // -- Functions --

    /**
     * @dev Initialize this contract.
     */
    function initialize(ISettings _settings, uint256 _lockPeriod, uint256 _unbondFeeRate) external initializer {
        __Ownable_init();

        indexerLeverageLimit = 10;
        maxUnbondingRequest = 20;

        unbondFeeRate = _unbondFeeRate;
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

    function setUnbondFeeRateBP(uint256 _unbondFeeRate) external onlyOwner {
        require(_unbondFeeRate < PER_MILL, 'S001');
        unbondFeeRate = _unbondFeeRate;
    }

    function setMaxUnbondingRequest(uint256 maxNum) external onlyOwner {
        maxUnbondingRequest = maxNum;
    }

    /**
     * @dev when Era update if valueAfter is the effective value, swap it to valueAt,
     * so later on we can update valueAfter without change current value
     * require it idempotent.
     */
    function reflectEraUpdate(address _source, address _indexer) public {
        uint256 eraNumber = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
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

    function removeUnbondingAmount(address _source, uint256 _unbondReqId) external onlyStakingManager {
        UnbondAmount memory ua = unbondingAmount[_source][_unbondReqId];
        delete unbondingAmount[_source][_unbondReqId];

        uint256 firstIndex = withdrawnLength[_source];
        uint256 lastIndex = unbondingLength[_source] - 1;
        if (_unbondReqId == firstIndex) {
            for (uint256 i = firstIndex; i <= lastIndex; i++) {
                if (unbondingAmount[_source][i].amount == 0) {
                    withdrawnLength[_source] ++;
                } else {
                    break;
                }
            }
        } else if (_unbondReqId == lastIndex) {
            for (uint256 i = lastIndex; i >= firstIndex; i--) {
                if (unbondingAmount[_source][i].amount == 0) {
                    unbondingLength[_source] --;
                } else {
                    break;
                }
            }
        }

        emit UnbondCancelled(_source, ua.indexer, ua.amount, _unbondReqId);
    }

    function addDelegation(
        address _source,
        address _indexer,
        uint256 _amount
    ) external {
        require(msg.sender == settings.getContractAddress(SQContracts.StakingManager) || msg.sender == address(this), 'G008');
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
        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransferFrom(_source, address(this), _amount);

        this.addDelegation(_source, _indexer, _amount);
    }

    function removeDelegation(
        address _source,
        address _indexer,
        uint256 _amount
    ) external {
        require(msg.sender == settings.getContractAddress(SQContracts.StakingManager) || msg.sender == address(this), 'G008');
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
        IRewardsStaking rewardsStaking = IRewardsStaking(settings.getContractAddress(SQContracts.RewardsStaking));
        rewardsStaking.onStakeChange(_indexer, _source);
    }

    function startUnbond(
        address _source,
        address _indexer,
        uint256 _amount,
        UnbondType _type
    ) external {
        require(msg.sender == settings.getContractAddress(SQContracts.StakingManager) || msg.sender == address(this), 'G008');
        uint256 nextIndex = unbondingLength[_source];
        if (_type == UnbondType.Undelegation) {
            require(nextIndex - withdrawnLength[_source] < maxUnbondingRequest - 1, 'S006');
        }

        if (_type != UnbondType.Commission) {
            this.removeDelegation(_source, _indexer, _amount);
        }

        if (nextIndex - withdrawnLength[_source] == maxUnbondingRequest) {
            _type = UnbondType.Merge;
            nextIndex --;
        } else {
            unbondingLength[_source]++;
        }

        UnbondAmount storage uamount = unbondingAmount[_source][nextIndex];
        uamount.amount += _amount;
        uamount.startTime = block.timestamp;
        uamount.indexer = _indexer;

        emit UnbondRequested(_source, _indexer, _amount, nextIndex, _type);
    }

    /**
     * @dev Withdraw a single request.
     * burn the withdrawn fees and transfer the rest to delegator.
     */
    function withdrawARequest(address _source, uint256 _index) external onlyStakingManager {
        require(_index == withdrawnLength[_source], 'S009');
        withdrawnLength[_source]++;

        uint256 amount = unbondingAmount[_source][_index].amount;
        if (amount > 0) {
            // take specific percentage for fee
            uint256 feeAmount = MathUtil.mulDiv(unbondFeeRate, amount, PER_MILL);
            uint256 availableAmount = amount - feeAmount;

            address SQToken = settings.getContractAddress(SQContracts.SQToken);
            address treasury = settings.getContractAddress(SQContracts.Treasury);
            IERC20(SQToken).safeTransfer(treasury, feeAmount);
            IERC20(SQToken).safeTransfer(_source, availableAmount);

            lockedAmount[_source] -= amount;

            emit UnbondWithdrawn(_source, availableAmount, feeAmount, _index);
        }
    }

    function slashIndexer(address _indexer, uint256 _amount) external onlyStakingManager {
        uint256 amount = _amount;

        for (uint256 i = withdrawnLength[_indexer]; i < unbondingLength[_indexer]; i++) {
            if (amount > unbondingAmount[_indexer][i].amount) {
                amount -= unbondingAmount[_indexer][i].amount;
                delete unbondingAmount[_indexer][i];
                withdrawnLength[_indexer]++;
            } else if (amount == unbondingAmount[_indexer][i].amount){
                delete unbondingAmount[_indexer][i];
                withdrawnLength[_indexer]++;
                amount = 0;
                break;
            } else {
                unbondingAmount[_indexer][i].amount -= amount;
                amount = 0;
                break;
            }
        }

        if (amount > 0) {
            delegation[_indexer][_indexer].valueAt -= amount;
            totalStakingAmount[_indexer].valueAt -= amount;
            delegation[_indexer][_indexer].valueAfter -= amount;
            totalStakingAmount[_indexer].valueAfter -= amount;
        }

        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransfer(settings.getContractAddress(SQContracts.DisputeManager), _amount);
    }

    function unbondCommission(address _indexer, uint256 _amount) external {
        require(msg.sender == settings.getContractAddress(SQContracts.RewardsDistributer), 'G003');
        lockedAmount[_indexer] += _amount;
        this.startUnbond(_indexer, _indexer, _amount, UnbondType.Commission);
    }

    // -- Views --

    function isEmptyDelegation(address _source, address _indexer) external view returns (bool) {
        return delegation[_source][_indexer].valueAt == 0 && delegation[_source][_indexer].valueAfter == 0;
    }
}
