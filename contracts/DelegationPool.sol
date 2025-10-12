// Copyright (C) 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';

import './interfaces/ISettings.sol';
import './interfaces/IStakingManager.sol';
import './interfaces/IRewardsDistributor.sol';
import './interfaces/IEraManager.sol';
import './utils/MathUtil.sol';
import './Constants.sol';
import './Staking.sol';

/**
 * @title DelegationPool
 * @notice ## Overview
 * A Delegation Pool contract that allows aggregation of SQT to be pooled together and used to delegate to indexers.
 * Delegation should behave the same as if the user had delegated directly to an indexer. There is a manager (owner) of the pool
 * that determines the delegation strategy to indexers.
 *
 * ## Details
 *
 * ### Delegation
 * Users delegate their SQT to the pool and receive pool shares (ERC20 tokens) representing their stake in the pool. The pool manager can then
 * allocate those funds to the indexers they choose to optimise rewards.
 *
 * ### Undelegation
 * Users can then trigger undelegation which will burn their shares and
 * start a withdrawal process that then allows the user to withdraw their SQT after the lock period which is the same duration as if they had
 * directly delegated.
 *
 * ### Withdrawals
 * After the lock period, users can withdraw their SQT and rewards from the pool, minus and pool and unbonding fees.
 *
 * ### Managers
 * The pool manager is responsible for making sure the available assets in the pool are delegated to indexers to earn rewards.
 * The manager can do all the same functionality as delegating directly to an indexer such as delegate, undelegate, redelegate and claim rewards.
 * The manager can also trigger auto-compounding of rewards which claims rewards from all indexers as well as set a reward fee.
 */
contract DelegationPool is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    ERC20Upgradeable
{
    using SafeERC20 for IERC20;
    using MathUtil for uint256;

    // -- Storage --

    /// @notice Settings contract for getting other contract addresses
    ISettings public settings;

    /// @notice Array of indexers that pool has delegated to
    address[] public activeIndexers;

    /// @notice Mapping to track if indexer is in activeIndexers array
    mapping(address => bool) public isActiveIndexer;

    /// @notice Mapping of user unbonding requests
    mapping(address => UnbondRequest[]) public unbondingRequests;

    /// @notice Mapping to track total withdrawn unbond requests per user
    mapping(address => uint256) public withdrawnLength;

    /// @notice Available SQT in the pool (not yet delegated)
    uint256 public availableAssets;

    /// @notice Fee percentage in per-million (1000000 = 100%, 10000 = 1%)
    uint256 public feePerMill;

    /// @notice Accumulated fees available for withdrawal by controller
    uint256 public accumulatedFees;

    /// @notice Cached share price (assets per share) for current era, scaled by 1e18
    uint256 public currentEraSharePrice;

    /// @notice Last era when share price was updated
    uint256 public lastPriceUpdateEra;

    /// @notice Total assets at last price update
    uint256 public totalAssetsAtLastUpdate;

    /// @notice Total shares at last price update
    uint256 public totalSharesAtLastUpdate;

    /// @notice Total amount of unbond fees expected to be lost when withdrawing from Staking
    uint256 public expectedUnbondFees;

    /// @notice Total amount that needs to be undelegated from indexers (reserved for user withdrawals)
    /// This tracks assets still counted in delegated amounts but reserved for withdrawals
    uint256 public pendingUndelegationsFromIndexers;

    /// @notice Accumulated unbond fees collected from available asset withdrawals (to be sent to treasury)
    uint256 public accumulatedUnbondFees;

    /// @notice Struct for unbonding requests
    struct UnbondRequest {
        uint256 amount; // Amount of SQT to be withdrawn
        uint256 startTime; // When unbonding started
        bool completed; // Whether withdrawal is completed
    }

    // -- Events --

    /// @notice Emitted when user delegates to the pool
    event Delegated(address indexed user, uint256 amount, uint256 shares);

    /// @notice Emitted when user starts undelegation
    event UndelegationStarted(address indexed user, uint256 shares, uint256 amount);

    /// @notice Emitted when user completes withdrawal
    event Withdrawn(address indexed user, uint256 amount);

    /// @notice Emitted when manager delegates to an indexer
    event ManagerDelegated(address indexed indexer, uint256 amount);

    /// @notice Emitted when manager undelegates from an indexer
    event ManagerUndelegated(address indexed indexer, uint256 amount);

    /// @notice Emitted when manager redelegates between indexers
    event ManagerRedelegated(
        address indexed fromIndexer,
        address indexed toIndexer,
        uint256 amount
    );

    /// @notice Emitted when rewards are auto-compounded
    event RewardsCompounded(uint256 totalRewards, uint256 newShares);

    /// @notice Emitted when fee percentage is updated
    event FeeRateUpdated(uint256 newFeePerMill);

    /// @notice Emitted when fees are collected by controller
    event FeesCollected(address indexed controller, uint256 amount);

    /// @notice Emitted when fees are deducted from rewards
    event FeesDeducted(uint256 rewardAmount, uint256 feeAmount);

    /// @notice Emitted when manager needs to undelegate from indexers to fulfill withdrawal
    event UndelegationRequired(
        address indexed user,
        uint256 requiredAmount,
        uint256 remainingAmount
    );

    /// @notice Emitted when share price is updated for a new era
    event SharePriceUpdated(uint256 indexed era, uint256 pricePerShare);

    /// @notice Emitted when unbond fee is tracked for accounting
    event UnbondFeeTracked(uint256 amount, uint256 totalExpected);

    // -- Functions --

    /**
     * @dev Initialize this contract.
     * @param _settings Address of the Settings contract
     * @param _feePerMill Fee percentage in per-million (1000000 = 100%, 10000 = 1%)
     */
    function initialize(ISettings _settings, uint256 _feePerMill) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        __ERC20_init('SubQuery Delegation Pool Share', 'SQTdp');
        settings = _settings;
        feePerMill = _feePerMill;
        // Initialize share price at 1:1 ratio (1e18 = 1 SQT per share with 18 decimals precision)
        currentEraSharePrice = 1e18;
        lastPriceUpdateEra = 0;
    }

    /**
     * @dev Update the settings contract address
     * @param _settings New settings contract address
     */
    function updateSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    /**
     * @dev Set the fee percentage for reward collection
     * @param _feePerMill Fee percentage in per-million (1000000 = 100%, 10000 = 1%)
     */
    function setFeeRate(uint256 _feePerMill) external onlyOwner {
        feePerMill = _feePerMill;
        emit FeeRateUpdated(_feePerMill);
    }

    /**
     * @dev Collect a specific amount of accumulated fees
     * @param _amount Amount of fees to collect
     */
    function collectFees(uint256 _amount) external onlyOwner {
        require(_amount > 0, 'DP014');
        require(accumulatedFees >= _amount, 'DP015');

        IERC20 sqToken = IERC20(settings.getContractAddress(SQContracts.SQToken));

        accumulatedFees -= _amount;
        sqToken.safeTransfer(msg.sender, _amount);

        emit FeesCollected(msg.sender, _amount);
    }

    /**
     * @dev Collect all accumulated fees
     */
    function collectAllFees() external onlyOwner {
        require(accumulatedFees > 0, 'DP015');

        IERC20 sqToken = IERC20(settings.getContractAddress(SQContracts.SQToken));
        uint256 amount = accumulatedFees;

        accumulatedFees = 0;
        sqToken.safeTransfer(msg.sender, amount);

        emit FeesCollected(msg.sender, amount);
    }

    /**
     * @dev Add tokens to the delegation pool and receive shares
     * @param _amount Amount of SQT tokens to delegate
     */
    function delegate(uint256 _amount) external nonReentrant {
        require(_amount > 0, 'DP001');

        IERC20 sqToken = IERC20(settings.getContractAddress(SQContracts.SQToken));
        require(sqToken.balanceOf(msg.sender) >= _amount, 'DP002');

        // Update share price if era has changed before calculating shares
        _updateSharePriceIfNeeded();

        // Calculate shares to mint using era-locked price
        uint256 sharesToMint = _calculateSharesToMint(_amount);

        // Transfer tokens from user
        sqToken.safeTransferFrom(msg.sender, address(this), _amount);

        // Update state
        _mint(msg.sender, sharesToMint);

        // Update the pending undelegations to use this new deposit first and offset the available assets
        if (pendingUndelegationsFromIndexers > 0) {
            // Use new deposit to cover pending undelegations first
            if (_amount >= pendingUndelegationsFromIndexers) {
                // Fully cover pending undelegations
                availableAssets += (_amount - pendingUndelegationsFromIndexers);
                pendingUndelegationsFromIndexers = 0;
            } else {
                // Partially cover pending undelegations
                pendingUndelegationsFromIndexers -= _amount;
                // No change to availableAssets as all new deposit is used
            }
        } else {
            availableAssets += _amount;
        }

        emit Delegated(msg.sender, _amount, sharesToMint);
    }

    /**
     * @dev Start undelegation process by burning shares
     * @param shareAmount Number of shares to burn for undelegation
     */
    function undelegate(uint256 shareAmount) external nonReentrant {
        require(shareAmount > 0, 'DP003');
        require(balanceOf(msg.sender) >= shareAmount, 'DP004');

        // Calculate SQT amount to undelegate
        uint256 sqtAmount = _calculateAssetsFromShares(shareAmount);
        require(sqtAmount > 0, 'DP005');

        // Burn user shares
        _burn(msg.sender, shareAmount);

        uint256 unbondFeeRate = _getUnbondFeeRate();

        // Handle undelegation based on available assets
        if (availableAssets >= sqtAmount) {
            // Calculate unbond fee (applies to all undelegations)
            uint256 fee = MathUtil.mulDiv(unbondFeeRate, sqtAmount, PER_MILL);
            uint256 netAmount = sqtAmount - fee;

            // Direct withdrawal from available assets
            availableAssets -= sqtAmount;
            accumulatedUnbondFees += fee;
            _addUnbondRequest(msg.sender, netAmount, block.timestamp);
        } else {
            // Need to undelegate from indexers via Staking
            // Amount from available assets is the whole amount because they would all be consumed by this undelegation
            uint256 amountFromAvailable = availableAssets;
            uint256 amountFromIndexers = sqtAmount - amountFromAvailable;

            // Calculate fees from each source
            uint256 feeFromAvailable = MathUtil.mulDiv(
                unbondFeeRate,
                amountFromAvailable,
                PER_MILL
            );
            uint256 feeFromIndexers = MathUtil.mulDiv(unbondFeeRate, amountFromIndexers, PER_MILL);

            // Calculate net amounts after fees
            uint256 netFromAvailable = amountFromAvailable - feeFromAvailable;
            uint256 netFromIndexers = amountFromIndexers - feeFromIndexers;

            // Track fees: accumulated (from available) and expected (from indexers)
            accumulatedUnbondFees += feeFromAvailable;
            expectedUnbondFees += feeFromIndexers;
            emit UnbondFeeTracked(feeFromIndexers, expectedUnbondFees);

            // Consume available assets (gross amount including fee)
            availableAssets -= amountFromAvailable;

            // Create unbond request for net total and trigger indexer undelegation
            uint256 netTotal = netFromAvailable + netFromIndexers;
            _addUnbondRequest(msg.sender, netTotal, block.timestamp);

            if (amountFromIndexers > 0) {
                // Track GROSS amount from indexers (still counted in delegated amounts)
                pendingUndelegationsFromIndexers += amountFromIndexers;
                emit UndelegationRequired(msg.sender, netTotal, amountFromIndexers);
            }
        }

        emit UndelegationStarted(msg.sender, shareAmount, sqtAmount);
    }

    /**
     * @dev Withdraw matured unbonding requests
     */
    function withdraw() external nonReentrant {
        require(unbondingRequests[msg.sender].length > withdrawnLength[msg.sender], 'DP006');

        IERC20 sqToken = IERC20(settings.getContractAddress(SQContracts.SQToken));

        uint256 totalWithdrawable = 0;
        uint256 currentWithdrawnLength = withdrawnLength[msg.sender];

        // Process up to 10 mature requests
        for (
            uint256 i = currentWithdrawnLength;
            i < unbondingRequests[msg.sender].length && i < currentWithdrawnLength + 10;
            i++
        ) {
            UnbondRequest storage request = unbondingRequests[msg.sender][i];

            if (request.completed) {
                continue;
            }

            // Check if unbonding period has passed
            uint256 lockPeriod = _getLockPeriod();
            if (block.timestamp - request.startTime < lockPeriod) {
                break; // Stop at first non-mature request
            }
            totalWithdrawable += request.amount;
            request.completed = true;
            withdrawnLength[msg.sender]++;
        }

        require(totalWithdrawable > 0, 'DP007');

        // Transfer accumulated fees to treasury if any
        if (accumulatedUnbondFees > 0) {
            address treasury = settings.getContractAddress(SQContracts.Treasury);
            uint256 feesToTransfer = accumulatedUnbondFees;
            accumulatedUnbondFees = 0;
            sqToken.safeTransfer(treasury, feesToTransfer);
        }

        // Transfer net amount to user (fee already deducted when undelegating)
        sqToken.safeTransfer(msg.sender, totalWithdrawable);

        emit Withdrawn(msg.sender, totalWithdrawable);
    }

    /**
     * @dev Manager delegates pool funds to an indexer
     * @param _runner Indexer address to delegate to
     * @param _amount Amount of SQT to delegate
     */
    function managerDelegate(address _runner, uint256 _amount) external onlyOwner {
        require(_runner != address(0), 'DP008');
        require(_amount > 0, 'DP001');
        require(availableAssets >= _amount, 'DP010');

        IStakingManager stakingManager = IStakingManager(
            settings.getContractAddress(SQContracts.StakingManager)
        );
        IERC20 sqToken = IERC20(settings.getContractAddress(SQContracts.SQToken));

        // Approve both Staking and StakingManager contracts to handle different implementations
        address stakingContract = settings.getContractAddress(SQContracts.Staking);
        sqToken.approve(stakingContract, _amount);
        sqToken.approve(address(stakingManager), _amount);

        // Delegate through StakingManager
        stakingManager.delegate(_runner, _amount);

        // Update pool state
        availableAssets -= _amount;

        // Add to active indexers if not already present
        if (!isActiveIndexer[_runner]) {
            activeIndexers.push(_runner);
            isActiveIndexer[_runner] = true;
        }

        emit ManagerDelegated(_runner, _amount);
    }

    /**
     * @dev Manager undelegates pool funds from an indexer
     * @param _runner Indexer address to undelegate from
     * @param _amount Amount of SQT to undelegate
     */
    function managerUndelegate(address _runner, uint256 _amount) external onlyOwner {
        require(_runner != address(0), 'DP008');
        require(_amount > 0, 'DP001');
        require(getDelegatedToIndexer(_runner) >= _amount, 'DP011');

        IStakingManager stakingManager = IStakingManager(
            settings.getContractAddress(SQContracts.StakingManager)
        );

        // Undelegate through StakingManager
        stakingManager.undelegate(_runner, _amount);

        // Clean up indexer from active list if no more delegation
        _cleanupIndexerIfEmpty(_runner);

        emit ManagerUndelegated(_runner, _amount);
    }

    /**
     * @dev Manager redelegates from one indexer to another
     * @param _fromRunner Source indexer address
     * @param _toRunner Destination indexer address
     * @param _amount Amount of SQT to redelegate
     */
    function managerRedelegate(
        address _fromRunner,
        address _toRunner,
        uint256 _amount
    ) external onlyOwner {
        require(_fromRunner != address(0) && _toRunner != address(0), 'DP008');
        require(_fromRunner != _toRunner, 'DP012');
        require(_amount > 0, 'DP001');
        require(getDelegatedToIndexer(_fromRunner) >= _amount, 'DP011');

        IStakingManager stakingManager = IStakingManager(
            settings.getContractAddress(SQContracts.StakingManager)
        );

        // Redelegate through StakingManager
        stakingManager.redelegate(_fromRunner, _toRunner, _amount);

        // Add destination to active indexers if not present
        if (!isActiveIndexer[_toRunner]) {
            activeIndexers.push(_toRunner);
            isActiveIndexer[_toRunner] = true;
        }

        // Clean up source indexer if no more delegation
        _cleanupIndexerIfEmpty(_fromRunner);

        emit ManagerRedelegated(_fromRunner, _toRunner, _amount);
    }

    function managerCancelUnbonding(uint256 unbondReqId) external onlyOwner {
        IStakingManager stakingManager = IStakingManager(
            settings.getContractAddress(SQContracts.StakingManager)
        );

        // Cancel unbonding through StakingManager
        stakingManager.cancelUnbonding(unbondReqId);
    }

    /**
     * @dev Automatic compound rewards for all active delegations
     */
    function autoCompound() external {
        require(activeIndexers.length > 0, 'DP013');

        // Update share price for new era BEFORE claiming rewards
        // This ensures any new deposits use the old price (no reward benefit)
        _updateSharePriceIfNeeded();

        IStakingManager stakingManager = IStakingManager(
            settings.getContractAddress(SQContracts.StakingManager)
        );
        IERC20 sqToken = IERC20(settings.getContractAddress(SQContracts.SQToken));

        uint256 rewardsBefore = sqToken.balanceOf(address(this));
        stakingManager.batchStakeReward(activeIndexers);
        uint256 rewardsAfter = sqToken.balanceOf(address(this));

        uint256 totalRewards = rewardsAfter - rewardsBefore;

        if (totalRewards == 0) {
            return; // No rewards to compound
        }

        // Calculate and deduct fees from rewards
        uint256 feeAmount = 0;
        if (feePerMill > 0) {
            feeAmount = (totalRewards * feePerMill) / PER_MILL;
            accumulatedFees += feeAmount;
            emit FeesDeducted(totalRewards, feeAmount);
        }

        // Add remaining rewards to available assets for compounding
        uint256 compoundAmount = totalRewards - feeAmount;
        availableAssets += compoundAmount;

        // With ERC20 shares, rewards automatically compound through increased asset base
        // The share value increases rather than minting new shares
        // This maintains existing share holders' proportional ownership while increasing their value

        emit RewardsCompounded(totalRewards, 0);
    }

    // -- Views --

    // /**
    //  * @dev Get user's delegation amount in the pool
    //  * @param _user User address
    //  * @return User's delegation amount in SQT
    //  */
    function getDelegationAmount(address _user) external view returns (uint256) {
        if (totalSupply() == 0) return 0;
        return _calculateAssetsFromShares(balanceOf(_user));
    }

    /**
     * @dev Get total assets managed by the pool
     * @return Total SQT assets in the pool
     */
    function getTotalAssets() external view returns (uint256) {
        return _calculateTotalAssets();
    }

    /**
     * @dev Get number of active indexers
     * @return Number of indexers the pool has delegated to
     */
    function getActiveIndexersCount() external view returns (uint256) {
        return activeIndexers.length;
    }

    /**
     * @dev Get active indexers list
     * @return Array of active indexer addresses
     */
    function getActiveIndexers() external view returns (address[] memory) {
        return activeIndexers;
    }

    /**
     * @dev Get total pending rewards available for compounding
     * @return Total pending rewards across all active indexers
     */
    function getPendingRewards() external view returns (uint256) {
        if (activeIndexers.length == 0) {
            return 0;
        }

        address rewardsDistributorAddress = settings.getContractAddress(
            SQContracts.RewardsDistributor
        );

        // Return 0 if RewardsDistributor is not configured
        if (rewardsDistributorAddress == address(0)) {
            return 0;
        }

        IRewardsDistributor rewardsDistributor = IRewardsDistributor(rewardsDistributorAddress);

        uint256 totalPendingRewards = 0;
        for (uint256 i = 0; i < activeIndexers.length; i++) {
            uint256 pendingReward = rewardsDistributor.userRewards(
                activeIndexers[i],
                address(this)
            );
            totalPendingRewards += pendingReward;
        }

        return totalPendingRewards;
    }

    /**
     * @dev Get amount delegated to specific indexer
     * @param _indexer Indexer address
     * @return Amount delegated to the indexer
     */
    function getDelegatedToIndexer(address _indexer) public view returns (uint256) {
        IStakingManager stakingManager = IStakingManager(
            settings.getContractAddress(SQContracts.StakingManager)
        );

        // Use the after (current era) amount here so we get the amount locked, even if its not active yet
        return stakingManager.getAfterDelegationAmount(address(this), _indexer);
    }

    /**
     * @dev Get pending unbond requests for user
     * @param _user User address
     * @return Array of unbond requests
     */
    function getPendingUnbonds(address _user) external view returns (UnbondRequest[] memory) {
        uint256 pendingCount = unbondingRequests[_user].length - withdrawnLength[_user];
        UnbondRequest[] memory pending = new UnbondRequest[](pendingCount);

        uint256 index = 0;
        for (uint256 i = withdrawnLength[_user]; i < unbondingRequests[_user].length; i++) {
            if (!unbondingRequests[_user][i].completed) {
                pending[index] = unbondingRequests[_user][i];
                index++;
            }
        }

        return pending;
    }

    /**
     * @dev Calculate expected shares for a given SQT amount
     * @param _amount Amount of SQT
     * @return Expected shares to be minted
     */
    function previewDeposit(uint256 _amount) external view returns (uint256) {
        return _calculateSharesToMint(_amount);
    }

    /**
     * @dev Calculate expected SQT amount for given shares
     * @param _shares Number of shares
     * @return Expected SQT amount to be received
     */
    function previewWithdraw(uint256 _shares) external view returns (uint256) {
        return _calculateAssetsFromShares(_shares);
    }

    /**
     * @dev Get accumulated fees available for collection
     * @return Amount of accumulated fees
     */
    function getAccumulatedFees() external view returns (uint256) {
        return accumulatedFees;
    }

    /**
     * @dev Get current fee rate
     * @return Fee percentage in per-million
     */
    function getFeeRate() external view returns (uint256) {
        return feePerMill;
    }

    /**
     * @dev Get the current era share price
     * @return Share price with 18 decimals precision (1e18 = 1 SQT per share)
     */
    function getCurrentSharePrice() external view returns (uint256) {
        return currentEraSharePrice;
    }

    /**
     * @dev Get the era of last price update
     * @return Era number when share price was last updated
     */
    function getLastPriceUpdateEra() external view returns (uint256) {
        return lastPriceUpdateEra;
    }

    // -- Internal Helper Functions --

    /**
     * @dev Calculate shares to mint for given SQT amount
     * Uses era-locked share price to prevent reward manipulation
     */
    function _calculateSharesToMint(uint256 _amount) internal view returns (uint256) {
        if (totalSupply() == 0) {
            return _amount; // 1:1 ratio for first deposit
        }

        // Use the current era's locked share price
        // shares = (amount * 1e18) / pricePerShare
        if (currentEraSharePrice > 0) {
            return (_amount * 1e18) / currentEraSharePrice;
        }

        // Fallback to current calculation if price not set (should rarely happen)
        uint256 totalAssets = _calculateTotalAssets();
        if (totalAssets == 0) {
            return _amount;
        }
        return (_amount * totalSupply()) / totalAssets;
    }

    /**
     * @dev Calculate SQT assets from share amount
     */
    function _calculateAssetsFromShares(uint256 _shares) internal view returns (uint256) {
        if (totalSupply() == 0 || _shares == 0) {
            return 0;
        }

        uint256 totalAssets = _calculateTotalAssets();
        return (_shares * totalAssets) / totalSupply();
    }

    /**
     * @dev Calculate total assets under management
     * Accounts for:
     * - Pending undelegations from indexers (assets reserved for withdrawal but still counted in delegated amounts)
     * - Expected unbond fees that will be lost when withdrawing from Staking
     * - Accumulated unbond fees (collected but not yet sent to treasury)
     */
    function _calculateTotalAssets() internal view returns (uint256) {
        uint256 totalDelegated = 0;

        // Sum up all delegated amounts
        for (uint256 i = 0; i < activeIndexers.length; i++) {
            totalDelegated += getDelegatedToIndexer(activeIndexers[i]);
        }

        uint256 grossAssets = availableAssets + totalDelegated;

        // Subtract:
        // - pending undelegations from indexers (reserved for withdrawals, no longer backing shares)
        // - expected fees that will be lost when manager withdraws from Staking
        // - accumulated fees (still in availableAssets but reserved for treasury)
        uint256 totalDeductions = pendingUndelegationsFromIndexers +
            expectedUnbondFees +
            accumulatedUnbondFees;

        if (grossAssets > totalDeductions) {
            return grossAssets - totalDeductions;
        }

        return 0;
    }

    /**
     * @dev Add unbond request for user
     */
    function _addUnbondRequest(address _user, uint256 _amount, uint256 _startTime) internal {
        unbondingRequests[_user].push(
            UnbondRequest({ amount: _amount, startTime: _startTime, completed: false })
        );
    }

    /**
     * @dev Get lock period from Staking contract
     */
    function _getLockPeriod() internal view returns (uint256) {
        // Get lock period from Staking contract through StakingManager
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        return staking.lockPeriod();
    }

    /**
     * @dev Get unbond fee rate from Staking contract
     */
    function _getUnbondFeeRate() internal view returns (uint256) {
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        return staking.unbondFeeRate();
    }

    /**
     * @dev Remove indexer from active list if delegation is zero
     */
    function _cleanupIndexerIfEmpty(address _indexer) internal {
        if (getDelegatedToIndexer(_indexer) == 0 && isActiveIndexer[_indexer]) {
            // Find and remove from array
            for (uint256 i = 0; i < activeIndexers.length; i++) {
                if (activeIndexers[i] == _indexer) {
                    activeIndexers[i] = activeIndexers[activeIndexers.length - 1];
                    activeIndexers.pop();
                    break;
                }
            }
            isActiveIndexer[_indexer] = false;
        }
    }

    /**
     * @dev Updates share price checkpoint if we're in a new era
     * This prevents reward manipulation by locking share prices within each era
     */
    function _updateSharePriceIfNeeded() internal {
        IEraManager eraManager = IEraManager(settings.getContractAddress(SQContracts.EraManager));
        uint256 currentEra = eraManager.eraNumber();

        // Only update if era has changed and we have shares outstanding
        if (currentEra > lastPriceUpdateEra && totalSupply() > 0) {
            uint256 totalAssets = _calculateTotalAssets();

            // Calculate new share price: (totalAssets * 1e18) / totalSupply
            // This gives us price per share with 18 decimals precision
            currentEraSharePrice = (totalAssets * 1e18) / totalSupply();

            lastPriceUpdateEra = currentEra;
            totalAssetsAtLastUpdate = totalAssets;
            totalSharesAtLastUpdate = totalSupply();

            emit SharePriceUpdated(currentEra, currentEraSharePrice);
        }
    }
}
