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
import './interfaces/IIndexerRegistry.sol';
import './interfaces/ISQToken.sol';
import './Constants.sol';
import './utils/MathUtil.sol';
import './utils/StakingUtil.sol';

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

    // Staking address by indexer number.
    mapping(uint256 => address) public indexers;

    // Indexer number by staking address.
    mapping(address => uint256) public indexerNo;

    // Staking amount per indexer address.
    mapping(address => StakingAmount) private totalStakingAmount;

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

    // Delegation tax rate per indexer
    mapping(address => CommissionRate) public commissionRates;

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
    event UnbondRequested(address indexed source, address indexed indexer, uint256 amount, uint256 index);

    /**
     * @dev Emitted when request withdraw.
     */
    event UnbondWithdrawn(address indexed source, uint256 amount, uint256 index);

    /**
     * @dev Emitted when delegtor cancel unbond request.
     */
    event UnbondCancelled(address indexed source, address indexed indexer, uint256 amount, uint256 index);

    /**
     * @dev Emitted when Indexer set their commissionRate.
     */
    event SetCommissionRate(address indexed indexer, uint256 amount);

    // -- Functions --

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
        require(_unbondFeeRate < PER_MILL, 'Invaild unbondFeeRate');
        unbondFeeRate = _unbondFeeRate;
    }

    /**
     * @dev Set initial commissionRate only called by indexerRegistry contract,
     * when indexer do registration. The commissionRate need to apply at once.
     */
    function setInitialCommissionRate(address indexer, uint256 rate) external {
        require(msg.sender == settings.getIndexerRegistry(), 'Only IndexerRegistry');
        IRewardsStaking rewardsStaking = IRewardsStaking(settings.getRewardsStaking());
        require(rewardsStaking.getTotalStakingAmount(indexer) == 0, 'Not settled');
        require(rate <= PER_MILL, 'Invalid rate');
        uint256 eraNumber = IEraManager(settings.getEraManager()).safeUpdateAndGetEra();
        commissionRates[indexer] = CommissionRate(eraNumber, rate, rate);

        emit SetCommissionRate(indexer, rate);
    }

    /**
     * @dev Set commissionRate only called by Indexer.
     * The commissionRate need to apply at two Eras after.
     */
    function setCommissionRate(uint256 rate) external {
        IIndexerRegistry indexerRegistry = IIndexerRegistry(settings.getIndexerRegistry());
        IRewardsStaking rewardsStaking = IRewardsStaking(settings.getRewardsStaking());
        require(indexerRegistry.isIndexer(msg.sender), 'Not indexer');
        require(rate <= PER_MILL, 'Invalid rate');
        uint256 eraNumber = IEraManager(settings.getEraManager()).safeUpdateAndGetEra();
        rewardsStaking.onICRChange(msg.sender, eraNumber + 2);
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
        uint256 eraNumber = IEraManager(settings.getEraManager()).safeUpdateAndGetEra();
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

    function _checkDelegateLimitation(address _indexer, uint256 _amount) private view {
        require(
            delegation[_indexer][_indexer].valueAfter * indexerLeverageLimit >=
                totalStakingAmount[_indexer].valueAfter + _amount,
            'Delegation limitation'
        );
    }

    function _addDelegation(
        address _source,
        address _indexer,
        uint256 _amount
    ) internal {
        require(_amount > 0, 'Invalid delegation');
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
            require(_source == _indexer, 'Not indexer');
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
            require(msg.sender == settings.getIndexerRegistry(), 'Only IndexerRegistry');
            indexers[indexerLength] = _indexer;
            indexerNo[_indexer] = indexerLength;
            indexerLength++;
        } else {
            require(msg.sender == _indexer, 'Only indexer');
        }
        _delegateToIndexer(_indexer, _indexer, _amount);
    }

    /**
     * @dev Delegator stake to Indexer, Indexer cannot call this.
     */
    function delegate(address _indexer, uint256 _amount) external override {
        require(msg.sender != _indexer, 'Only delegator');
        reflectEraUpdate(msg.sender, _indexer);
        // delegation limit should not exceed
        _checkDelegateLimitation(_indexer, _amount);
        _delegateToIndexer(msg.sender, _indexer, _amount);
    }

    function _removeDelegation(
        address _source,
        address _indexer,
        uint256 _amount
    ) internal {
        require(_amount > 0, 'Invalid amount');
        require(delegation[_source][_indexer].valueAfter >= _amount, 'Insufficient delegation');

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
        require(from_indexer != msg.sender, 'Only delegator');
        // delegation limit should not exceed
        _checkDelegateLimitation(to_indexer, _amount);

        uint256 eraNumber = IEraManager(settings.getEraManager()).safeUpdateAndGetEra();
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
        UnbondAmount storage uamount = unbondingAmount[_source][index];
        uamount.amount = _amount;
        uamount.startTime = block.timestamp;
        uamount.indexer = _indexer;
        unbondingLength[_source]++;

        emit UnbondRequested(_source, _indexer, _amount, index);
    }

    function cancelUnbonding(uint256 unbondReqId) external {
        require(unbondReqId >= withdrawnLength[msg.sender], 'Withdrawn');
        UnbondAmount memory unbond = unbondingAmount[msg.sender][unbondReqId];
        require(unbond.amount > 0, 'Invalid unbond');
        IIndexerRegistry indexerRegistry = IIndexerRegistry(settings.getIndexerRegistry());
        require(indexerRegistry.isIndexer(unbond.indexer), 'Unregistered');

        delete unbondingAmount[msg.sender][unbondReqId];
        if (msg.sender != unbond.indexer) {
            _checkDelegateLimitation(unbond.indexer, unbond.amount);
        }
        _addDelegation(msg.sender, unbond.indexer, unbond.amount);

        emit UnbondCancelled(msg.sender, unbond.indexer, unbond.amount, unbondReqId);
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
            require(msg.sender == _indexer, 'Only indexer');
            require(
                this.getAfterDelegationAmount(_indexer, _indexer) - _amount >
                    IIndexerRegistry(settings.getIndexerRegistry()).minimumStakingAmount(),
                'Insufficient stake'
            );
        }
        _startUnbond(_indexer, _indexer, _amount);
    }

    /**
     * @dev Request a unbond from an indexer for specific amount.
     */
    function undelegate(address _indexer, uint256 _amount) external override {
        // check if called by an indexer
        require(_indexer != msg.sender, 'Only delegator');
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
        require(withdrawingLength > 0, 'Need unbond');

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
            //skip withdraw zero amount unbond request (canceled unbond request)
            if (unbondingAmount[msg.sender][i].amount == 0) {
                withdrawnLength[msg.sender]++;
                break;
            }

            _withdrawARequest(i);
        }
    }

    // -- Views --

    function _isEmptyDelegation(address _source, address _indexer) internal view returns (bool) {
        return delegation[_source][_indexer].valueAt == 0 && delegation[_source][_indexer].valueAfter == 0;
    }

    function getTotalStakingAmount(address _indexer) external view override returns (uint256) {
        uint256 eraNumber = IEraManager(settings.getEraManager()).eraNumber();
        return StakingUtil.currentStaking(totalStakingAmount[_indexer], eraNumber);
    }

    function getCommissionRate(address indexer) external view returns (uint256) {
        uint256 eraNumber = IEraManager(settings.getEraManager()).eraNumber();
        return StakingUtil.currentCommission(commissionRates[indexer], eraNumber);
    }

    function getAfterDelegationAmount(address _source, address _indexer) external view override returns (uint256) {
        return delegation[_source][_indexer].valueAfter;
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
}
