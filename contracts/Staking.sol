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
import './interfaces/IIndexerRegistry.sol';
import './interfaces/ISQToken.sol';
import './Constants.sol';
import './MathUtil.sol';

/**
 * @title Staking Contract
 * @dev
 * ## Overview
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
 * users make these changes, we call onStakeChange()/onICRChnage() from rewardsDistributer contract to notify it to
 * apply these changes for future distribution.
 * In our design rewardsDistributer contract apply the first stake change and commission rate change immediately when
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

    // -- Data --

    /**
     * @dev Total staking amount information. One per Indexer.
     * Stake amount change need to be applied at next Era.
     */
    struct StakingAmount {
        uint256 era; //last update era
        uint256 valueAt; //value at the era
        uint256 valueAfter; //value to be refresed from next era
    }

    /**
     * @dev Unbond amount information. One per request per Delegator.
     * Delegator can withdraw the unbond amount after the lockPeriod.
     */
    struct UnbondAmount {
        uint256 amount; //pending unbonding amount
        uint256 startTime; //unbond start time
    }

    /**
     * @dev Commission rate information. One per Indexer.
     * Commission rate change need to be applied at the Era after next Era.
     */
    struct CommissionRate {
        uint256 era; //last update era
        uint256 valueAt; //value at the era
        uint256 valueAfter; //value to be refresed from next era
    }

    // -- Storage --

    ISettings public settings;
    /**
     * The ratio of total stake amount to indexer self stake amount to limit the
     * total delegation amount. Initial value is set to 10, which means the total
     * stake amount cannot exceed 10 times the indexer self stake amount.
     */
    uint256 public indexerLeverageLimit;
    //The rate of token burn when withdraw.
    uint256 public unbondFeeRate;
    //Lock period for withdraw, timestamp unit
    uint256 public lockPeriod;
    //Number of registered indexers.
    uint256 public indexerLength;
    //Staking address by indexer number.
    mapping(uint256 => address) public indexers;
    //Indexer number by staking address.
    mapping(address => uint256) public indexerNo;
    //Staking amount per indexer address.
    mapping(address => StakingAmount) totalStakingAmount;
    //delegator address -> unbond request index -> amount&startTime
    mapping(address => mapping(uint256 => UnbondAmount)) unbondingAmount;
    //delegator address -> length of unbond requests
    mapping(address => uint256) public unbondingLength;
    //delegator address -> length of widthdrawn requests
    mapping(address => uint256) public withdrawnLength;
    //active delegation from delegator to indexer, delegator->indexer->amount
    mapping(address => mapping(address => StakingAmount)) delegation;
    //each delegator total locked amount, delegator->amount
    //lockedAmount include stakedAmount + amount in locked period
    mapping(address => uint256) public lockedAmount;
    //actively staking indexers by delegator
    mapping(address => mapping(uint256 => address)) public stakingIndexers;
    //delegating indexer number by delegator and indexer
    mapping(address => mapping(address => uint256)) public stakingIndexerNos;
    //staking indexer lengths
    mapping(address => uint256) stakingIndexerLengths;
    //delegation tax rate per indexer
    mapping(address => CommissionRate) public commissionRates;

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
    event UnbondRequested(address indexed source, address indexed indexer, uint256 amount, uint256 index);
    /**
     * @dev Emitted when request withdraw.
     */
    event UnbondWithdrawn(address indexed source, uint256 amount, uint256 index);
    /**
     * @dev Emitted when Indexer set their commissionRate.
     */
    event SetCommissionRate(address indexed indexer, uint256 amount);

    /**
     * @dev Initialize this contract.
     */
    function initialize(uint256 _lockPeriod, ISettings _settings) external initializer {
        __Ownable_init();

        indexerLeverageLimit = 10;
        unbondFeeRate = 1e3;

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
        require(_unbondFeeRate < PER_MILL, 'fee rate can not be larger than 1e6');
        unbondFeeRate = _unbondFeeRate;
    }

    /**
     * @dev Set initial commissionRate only called by indexerRegistry contract,
     * when indexer do registration. The commissionRate need to apply at once.
     */
    function setInitialCommissionRate(address indexer, uint256 rate) public {
        require(msg.sender == settings.getIndexerRegistry(), 'Caller is not indexerRegistry');
        IRewardsDistributer rewardDistributer = IRewardsDistributer(settings.getRewardsDistributer());
        require(rewardDistributer.getTotalStakingAmount(indexer) == 0, 'Last registry not settled');
        require(rate <= PER_MILL, 'Invalid commission rate');
        IEraManager eraManager = IEraManager(settings.getEraManager());
        uint256 eraNumber = eraManager.safeUpdateAndGetEra();
        commissionRates[indexer] = CommissionRate(eraNumber, rate, rate);

        emit SetCommissionRate(indexer, rate);
    }

    /**
     * @dev Set commissionRate only called by Indexer.
     * The commissionRate need to apply at two Eras after.
     */
    function setCommissionRate(uint256 rate) public {
        IIndexerRegistry indexerRegistry = IIndexerRegistry(settings.getIndexerRegistry());
        IRewardsDistributer rewardsDistributer = IRewardsDistributer(settings.getRewardsDistributer());
        require(indexerRegistry.isIndexer(msg.sender), 'Not an indexer');
        require(rate <= PER_MILL, 'Invalid commission rate');
        IEraManager eraManager = IEraManager(settings.getEraManager());
        uint256 eraNumber = eraManager.safeUpdateAndGetEra();
        rewardsDistributer.onICRChange(msg.sender, eraNumber + 2);
        CommissionRate storage commissionRate = commissionRates[msg.sender];
        if (commissionRate.era < eraNumber) {
            commissionRate.era = eraNumber;
            commissionRate.valueAt = commissionRate.valueAfter;
        }
        commissionRate.valueAfter = rate;

        emit SetCommissionRate(msg.sender, rate);
    }

    /**
     * @dev when Era update if valueAfter is the effective value, swap it to valueAt,
     * so later on we can update valueAfter without change current value
     * require it idempotent.
     */
    function reflectEraUpdate(address _source, address _indexer) public {
        IEraManager eraManager = IEraManager(settings.getEraManager());
        uint256 eraNumber = eraManager.safeUpdateAndGetEra();
        _reflectEraUpdate(eraNumber, _source, _indexer);
    }

    function _reflectEraUpdate(
        uint256 eraNumber,
        address _source,
        address _indexer
    ) private {
        _reflectStakingAmount(eraNumber, delegation[_source][_indexer]);
        _reflectStakingAmount(eraNumber, totalStakingAmount[_indexer]);
    }

    function _reflectStakingAmount(uint256 eraNumber, StakingAmount storage stakeAmount) private {
        if (stakeAmount.era < eraNumber) {
            stakeAmount.era = eraNumber;
            stakeAmount.valueAt = stakeAmount.valueAfter;
        }
    }

    function _addDelegation(
        address _source,
        address _indexer,
        uint256 _amount
    ) internal {
        require(_amount > 0, 'delegation amount need to be a positive number');
        if (_isEmptyDelegation(_source, _indexer)) {
            stakingIndexerNos[_source][_indexer] = stakingIndexerLengths[_source];
            stakingIndexers[_source][stakingIndexerLengths[_source]] = _indexer;
            stakingIndexerLengths[_source]++;
        }
        // first stake from indexer
        bool firstStake = _isEmptyDelegation(_indexer, _indexer) &&
            totalStakingAmount[_indexer].valueAt == 0 &&
            totalStakingAmount[_indexer].valueAfter == 0;
        if (firstStake) {
            require(_source == _indexer, 'can not delegate to non-indexer');
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

    function _delegateToIndexer(
        address _source,
        address _indexer,
        uint256 _amount
    ) internal {
        IERC20(settings.getSQToken()).safeTransferFrom(_source, address(this), _amount);

        _addDelegation(_source, _indexer, _amount);
    }

    /**
     * @dev Indexers stake to themself.
     * The caller can be either an existing indexer or IndexerRegistry contract. The staking change will be applied immediately if the caller is IndexerRegistry.
     */
    function stake(address _indexer, uint256 _amount) external override {
        reflectEraUpdate(_indexer, _indexer);
        if (_isEmptyDelegation(_indexer, _indexer)) {
            require(msg.sender == settings.getIndexerRegistry(), 'Caller is not indexerRegistry');
            indexers[indexerLength] = _indexer;
            indexerNo[_indexer] = indexerLength;
            indexerLength++;
        } else {
            require(msg.sender == _indexer, 'only indexer can call stake()');
        }
        _delegateToIndexer(_indexer, _indexer, _amount);
    }

    /**
     * @dev Delegator stake to Indexer, Indexer cannot call this.
     */
    function delegate(address _indexer, uint256 _amount) external override {
        require(msg.sender != _indexer, 'indexer can not call delegate() use stake() instead');
        reflectEraUpdate(msg.sender, _indexer);
        // delegation limit should not exceed
        require(
            delegation[_indexer][_indexer].valueAfter * indexerLeverageLimit >=
                totalStakingAmount[_indexer].valueAfter + _amount,
            'Delegation limitation reached'
        );

        _delegateToIndexer(msg.sender, _indexer, _amount);
    }

    function _removeDelegation(
        address _source,
        address _indexer,
        uint256 _amount
    ) internal {
        require(_amount > 0, 'Amount should be positive');
        require(
            delegation[_source][_indexer].valueAfter >= _amount,
            'Removed delegation cannot be greater than current amount'
        );

        delegation[_source][_indexer].valueAfter -= _amount;
        totalStakingAmount[_indexer].valueAfter -= _amount;

        _onDelegationChange(_source, _indexer);

        emit DelegationRemoved(_source, _indexer, _amount);
    }

    /**
     * @dev When the delegation change nodify rewardsDistributer to deal with the change.
     */
    function _onDelegationChange(address _source, address _indexer) internal {
        IRewardsDistributer rewardsDistributer = IRewardsDistributer(settings.getRewardsDistributer());
        rewardsDistributer.onStakeChange(_indexer, _source);
    }

    /**
     * @dev Allow delegator transfer their delegation from an indexer to another.
     * Indexer's self delegations are not allow to redelegate.
     */
    function redelegate(
        address from_indexer,
        address to_indexer,
        uint256 _amount
    ) external override {
        address _source = msg.sender;

        require(from_indexer != msg.sender, 'Self delegation can not be redelegated');

        // delegation limit should not exceed
        require(
            delegation[to_indexer][to_indexer].valueAfter * indexerLeverageLimit >=
                totalStakingAmount[to_indexer].valueAfter + _amount,
            'Delegation limitation reached'
        );

        IEraManager eraManager = IEraManager(settings.getEraManager());
        uint256 eraNumber = eraManager.safeUpdateAndGetEra();
        _reflectEraUpdate(eraNumber, _source, from_indexer);
        _removeDelegation(_source, from_indexer, _amount);
        _reflectEraUpdate(eraNumber, _source, to_indexer);
        _addDelegation(_source, to_indexer, _amount);
    }

    function _startUnbond(
        address _source,
        address _indexer,
        uint256 _amount
    ) internal {
        _removeDelegation(_source, _indexer, _amount);

        uint256 index = unbondingLength[_source];
        unbondingAmount[_source][index].amount = _amount;
        unbondingAmount[_source][index].startTime = block.timestamp;
        unbondingLength[_source]++;

        emit UnbondRequested(_source, _indexer, _amount, index);
    }

    /**
     * @dev Unstake Indexer's self delegation. When this is called by indexer,
     * the existential amount should be greater than minimum staking amount
     * If the caller is from IndexerRegistry, this function will unstake all the staking token for the indexer.
     */
    function unstake(address _indexer, uint256 _amount) external override {
        reflectEraUpdate(_indexer, _indexer);
        if (msg.sender == settings.getIndexerRegistry()) {
            indexers[indexerNo[_indexer]] = indexers[indexerLength - 1];
            indexerNo[indexers[indexerLength - 1]] = indexerNo[_indexer];
            indexerLength--;
        } else {
            require(msg.sender == _indexer, 'only indexer can unstake()');
            require(
                this.getDelegationAmount(_indexer, _indexer) - _amount >
                    IIndexerRegistry(settings.getIndexerRegistry()).minimumStakingAmount(),
                'staked amount should be greater than minimum amount'
            );
        }
        _startUnbond(_indexer, _indexer, _amount);
    }

    /**
     * @dev Request a unbond from an indexer for specific amount.
     */
    function undelegate(address _indexer, uint256 _amount) external override {
        // check if called by an indexer
        require(_indexer != msg.sender, 'Self delegation can not unbond from staking');
        reflectEraUpdate(msg.sender, _indexer);
        _startUnbond(msg.sender, _indexer, _amount);
    }

    /**
     * @dev Withdraw a single request.
     * burn the withdrawn fees and transfer the rest to delegator.
     */
    function _withdrawARequest(uint256 _index) internal {
        // burn specific percentage
        uint256 amount = unbondingAmount[msg.sender][_index].amount;
        uint256 burnAmount = MathUtil.mulDiv(unbondFeeRate, amount, PER_MILL);
        uint256 availableAmount = amount - burnAmount;

        address SQToken = settings.getSQToken();
        ISQToken(SQToken).burn(burnAmount);
        IERC20(SQToken).safeTransfer(msg.sender, availableAmount);

        lockedAmount[msg.sender] -= amount;

        withdrawnLength[msg.sender]++;

        emit UnbondWithdrawn(msg.sender, availableAmount, _index);
    }

    /**
     * @dev Withdraw max 10 mature unbond requests from an indexer.
     * Each withdraw need to exceed lockPeriod.
     */
    function widthdraw() external override {
        uint256 withdrawingLength = unbondingLength[msg.sender] - withdrawnLength[msg.sender];
        require(withdrawingLength > 0, 'Need to request unbond before withdraw');

        // withdraw the max top 10 requests
        if (withdrawingLength > 10) {
            withdrawingLength = 10;
        }

        uint256 time;
        uint256 latestWithdrawnLength = withdrawnLength[msg.sender];
        for (uint256 i = latestWithdrawnLength; i < latestWithdrawnLength + withdrawingLength; i++) {
            time = block.timestamp - unbondingAmount[msg.sender][i].startTime;
            if (time < lockPeriod) {
                break;
            }

            _withdrawARequest(i);
        }
    }

    // -- Views --

    function _isEmptyDelegation(address _source, address _indexer) internal view returns (bool) {
        return delegation[_source][_indexer].valueAt == 0 && delegation[_source][_indexer].valueAfter == 0;
    }

    function _parseStakingAmount(StakingAmount memory amount) internal view returns (uint256) {
        IEraManager eraManager = IEraManager(settings.getEraManager());
        uint256 eraNumber = eraManager.eraNumber();
        if (amount.era < eraNumber) {
            return amount.valueAfter;
        }
        return amount.valueAt;
    }

    function getTotalEffectiveStake(address _indexer) external view override returns (uint256) {
        uint256 effectiveStake = _parseStakingAmount(totalStakingAmount[_indexer]);
        uint256 selfDelegation = _parseStakingAmount(delegation[_indexer][_indexer]);
        if (effectiveStake > selfDelegation * indexerLeverageLimit) {
            effectiveStake = selfDelegation * indexerLeverageLimit;
        }
        return effectiveStake;
    }

    function getTotalStakingAmount(address _indexer) external view override returns (uint256) {
        return _parseStakingAmount(totalStakingAmount[_indexer]);
    }

    function getDelegationAmount(address _source, address _indexer) external view override returns (uint256) {
        return delegation[_source][_indexer].valueAfter;
    }

    function getStakingIndexersLength(address _address) external view returns (uint256) {
        return stakingIndexerLengths[_address];
    }

    function getStakingAmount(address _source, address _indexer) external view returns (StakingAmount memory) {
        return delegation[_source][_indexer];
    }

    function getUnbondingAmount(address _source, uint256 _id) external view returns (UnbondAmount memory) {
        return unbondingAmount[_source][_id];
    }

    function getUnbondingAmounts(address _source) external view returns (UnbondAmount[] memory) {
        uint256 withdrawingLength = unbondingLength[_source] - withdrawnLength[_source];
        UnbondAmount[] memory unbondAmounts = new UnbondAmount[](withdrawingLength);

        uint256 i;
        uint256 latestWithdrawnLength = withdrawnLength[_source];
        for (uint256 j = latestWithdrawnLength; j < latestWithdrawnLength + withdrawingLength; j++) {
            unbondAmounts[i] = unbondingAmount[_source][j];
            i++;
        }

        return unbondAmounts;
    }

    function getCommissionRate(address indexer) external view returns (uint256) {
        IEraManager eraManager = IEraManager(settings.getEraManager());
        uint256 eraNumber = eraManager.eraNumber();
        CommissionRate memory commissionRate = commissionRates[indexer];
        if (commissionRate.era < eraNumber - 1) {
            return commissionRate.valueAfter;
        } else {
            return commissionRate.valueAt;
        }
    }
}
