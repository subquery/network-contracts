// Copyright (C) 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';

import './interfaces/ISettings.sol';
import './interfaces/IStakingManager.sol';
import './interfaces/IRewardsDistributor.sol';
import './utils/MathUtil.sol';

contract DelegationPool is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using MathUtil for uint256;

    // -- Storage --

    /// @notice Settings contract for getting other contract addresses
    ISettings public settings;

    /// @notice Total shares issued to delegators
    uint256 public totalShares;

    /// @notice Mapping of user addresses to their share balances
    mapping(address => uint256) public shares;

    /// @notice Mapping of indexer addresses to delegated amounts
    mapping(address => uint256) public delegatedToIndexer;

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

    /// @notice Emitted when settings contract is updated
    event SettingsUpdated(address indexed newSettings);

    // -- Functions --

    /**
     * @dev Initialize this contract.
     * @param _settings Address of the Settings contract
     */
    function initialize(ISettings _settings) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        settings = _settings;
    }

    /**
     * @dev Update the settings contract address
     * @param _settings New settings contract address
     */
    function updateSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
        emit SettingsUpdated(address(_settings));
    }

    /**
     * @dev Add tokens to the delegation pool and receive shares
     * @param _amount Amount of SQT tokens to delegate
     */
    function delegate(uint256 _amount) external nonReentrant {
        require(_amount > 0, 'DP001: Amount must be greater than 0');

        IERC20 sqToken = IERC20(settings.getContractAddress(SQContracts.SQToken));
        require(sqToken.balanceOf(msg.sender) >= _amount, 'DP002: Insufficient balance');

        // Calculate shares to mint
        uint256 sharesToMint = _calculateSharesToMint(_amount);

        // Transfer tokens from user
        sqToken.safeTransferFrom(msg.sender, address(this), _amount);

        // Update state
        shares[msg.sender] += sharesToMint;
        totalShares += sharesToMint;
        availableAssets += _amount;

        emit Delegated(msg.sender, _amount, sharesToMint);
    }

    /**
     * @dev Start undelegation process by burning shares
     * @param _shares Number of shares to burn for undelegation
     */
    function undelegate(uint256 _shares) external nonReentrant {
        require(_shares > 0, 'DP003: Shares must be greater than 0');
        require(shares[msg.sender] >= _shares, 'DP004: Insufficient shares');

        // Calculate SQT amount to undelegate
        uint256 sqtAmount = _calculateAssetsFromShares(_shares);
        require(sqtAmount > 0, 'DP005: No assets to undelegate');

        // Burn user shares
        shares[msg.sender] -= _shares;
        totalShares -= _shares;

        // Handle undelegation based on available assets
        if (availableAssets >= sqtAmount) {
            // Direct withdrawal from available assets
            availableAssets -= sqtAmount;
            _addUnbondRequest(msg.sender, sqtAmount, block.timestamp);
        } else {
            // Need to undelegate from indexers
            _handleUndelegationFromIndexers(msg.sender, sqtAmount);
        }

        emit UndelegationStarted(msg.sender, _shares, sqtAmount);
    }

    /**
     * @dev Withdraw matured unbonding requests
     */
    function withdraw() external nonReentrant {
        require(
            unbondingRequests[msg.sender].length > withdrawnLength[msg.sender],
            'DP006: No pending withdrawals'
        );

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
            if (block.timestamp - request.startTime >= lockPeriod) {
                totalWithdrawable += request.amount;
                request.completed = true;
                withdrawnLength[msg.sender]++;
            } else {
                break; // Stop at first non-mature request
            }
        }

        require(totalWithdrawable > 0, 'DP007: No mature withdrawals');

        // Transfer SQT to user
        sqToken.safeTransfer(msg.sender, totalWithdrawable);

        emit Withdrawn(msg.sender, totalWithdrawable);
    }

    /**
     * @dev Manager delegates pool funds to an indexer
     * @param _runner Indexer address to delegate to
     * @param _amount Amount of SQT to delegate
     */
    function managerDelegate(address _runner, uint256 _amount) external onlyOwner {
        require(_runner != address(0), 'DP008: Invalid runner address');
        require(_amount > 0, 'DP009: Amount must be greater than 0');
        require(availableAssets >= _amount, 'DP010: Insufficient available assets');

        IStakingManager stakingManager = IStakingManager(
            settings.getContractAddress(SQContracts.StakingManager)
        );
        IERC20 sqToken = IERC20(settings.getContractAddress(SQContracts.SQToken));

        // Approve StakingManager to spend tokens
        sqToken.approve(address(stakingManager), _amount);

        // Delegate through StakingManager
        stakingManager.delegate(_runner, _amount);

        // Update pool state
        availableAssets -= _amount;
        delegatedToIndexer[_runner] += _amount;

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
        require(_runner != address(0), 'DP011: Invalid runner address');
        require(_amount > 0, 'DP012: Amount must be greater than 0');
        require(delegatedToIndexer[_runner] >= _amount, 'DP013: Insufficient delegated amount');

        IStakingManager stakingManager = IStakingManager(
            settings.getContractAddress(SQContracts.StakingManager)
        );

        // Undelegate through StakingManager
        stakingManager.undelegate(_runner, _amount);

        // Update pool state
        delegatedToIndexer[_runner] -= _amount;

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
        require(
            _fromRunner != address(0) && _toRunner != address(0),
            'DP014: Invalid runner addresses'
        );
        require(_fromRunner != _toRunner, 'DP015: Cannot redelegate to same runner');
        require(_amount > 0, 'DP016: Amount must be greater than 0');
        require(delegatedToIndexer[_fromRunner] >= _amount, 'DP017: Insufficient delegated amount');

        IStakingManager stakingManager = IStakingManager(
            settings.getContractAddress(SQContracts.StakingManager)
        );

        // Redelegate through StakingManager
        stakingManager.redelegate(_fromRunner, _toRunner, _amount);

        // Update pool state
        delegatedToIndexer[_fromRunner] -= _amount;
        delegatedToIndexer[_toRunner] += _amount;

        // Add destination to active indexers if not present
        if (!isActiveIndexer[_toRunner]) {
            activeIndexers.push(_toRunner);
            isActiveIndexer[_toRunner] = true;
        }

        // Clean up source indexer if no more delegation
        _cleanupIndexerIfEmpty(_fromRunner);

        emit ManagerRedelegated(_fromRunner, _toRunner, _amount);
    }

    /**
     * @dev Automatic compound rewards for all active delegations
     */
    function autoCompound() external {
        require(activeIndexers.length > 0, 'DP018: No active delegations');

        IStakingManager stakingManager = IStakingManager(
            settings.getContractAddress(SQContracts.StakingManager)
        );
        uint256 totalRewards = 0;

        // Compound rewards for each active indexer
        for (uint256 i = 0; i < activeIndexers.length; i++) {
            address indexer = activeIndexers[i];
            uint256 rewardsBefore = IERC20(settings.getContractAddress(SQContracts.SQToken))
                .balanceOf(address(this));

            // Stake rewards through StakingManager (this claims and restakes rewards)
            try stakingManager.stakeReward(indexer) {
                uint256 rewardsAfter = IERC20(settings.getContractAddress(SQContracts.SQToken))
                    .balanceOf(address(this));
                uint256 indexerRewards = rewardsAfter - rewardsBefore;

                if (indexerRewards > 0) {
                    totalRewards += indexerRewards;
                    availableAssets += indexerRewards;
                }
            } catch {
                // Skip if no rewards available for this indexer
                continue;
            }
        }

        if (totalRewards > 0) {
            // Mint new shares proportionally to existing shareholders
            uint256 newShares = _calculateSharesToMint(totalRewards);

            // Distribute new shares proportionally to existing holders
            // This is done automatically through the share calculation mechanism
            totalShares += newShares;

            emit RewardsCompounded(totalRewards, newShares);
        }
    }

    // -- Views --

    /**
     * @dev Get user's delegation amount in the pool
     * @param _user User address
     * @return User's delegation amount in SQT
     */
    function getDelegationAmount(address _user) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return _calculateAssetsFromShares(shares[_user]);
    }

    /**
     * @dev Get total assets managed by the pool
     * @return Total SQT assets in the pool
     */
    function getTotalAssets() external view returns (uint256) {
        return _calculateTotalAssets();
    }

    /**
     * @dev Get user's share balance
     * @param _user User address
     * @return Number of shares owned by user
     */
    function getShares(address _user) external view returns (uint256) {
        return shares[_user];
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
     * @dev Get amount delegated to specific indexer
     * @param _indexer Indexer address
     * @return Amount delegated to the indexer
     */
    function getDelegatedToIndexer(address _indexer) external view returns (uint256) {
        return delegatedToIndexer[_indexer];
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

    // -- Internal Helper Functions --

    /**
     * @dev Calculate shares to mint for given SQT amount
     */
    function _calculateSharesToMint(uint256 _amount) internal view returns (uint256) {
        if (totalShares == 0) {
            return _amount; // 1:1 ratio for first deposit
        }

        uint256 totalAssets = _calculateTotalAssets();
        if (totalAssets == 0) {
            return _amount; // Fallback to 1:1 if no assets
        }

        return (_amount * totalShares) / totalAssets;
    }

    /**
     * @dev Calculate SQT assets from share amount
     */
    function _calculateAssetsFromShares(uint256 _shares) internal view returns (uint256) {
        if (totalShares == 0 || _shares == 0) {
            return 0;
        }

        uint256 totalAssets = _calculateTotalAssets();
        return (_shares * totalAssets) / totalShares;
    }

    /**
     * @dev Calculate total assets under management
     */
    function _calculateTotalAssets() internal view returns (uint256) {
        uint256 totalDelegated = 0;

        // Sum up all delegated amounts
        for (uint256 i = 0; i < activeIndexers.length; i++) {
            totalDelegated += delegatedToIndexer[activeIndexers[i]];
        }

        return availableAssets + totalDelegated;
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
     * @dev Handle undelegation when need to withdraw from indexers
     */
    function _handleUndelegationFromIndexers(address _user, uint256 _amount) internal {
        // For now, add to unbond queue and let manager handle the actual undelegation
        // This ensures the undelegation follows the same timing as direct delegation
        _addUnbondRequest(_user, _amount, block.timestamp);

        // Reduce available assets (will be negative, manager needs to undelegate)
        if (availableAssets > 0) {
            if (_amount > availableAssets) {
                _amount -= availableAssets;
                availableAssets = 0;
            } else {
                availableAssets -= _amount;
                _amount = 0;
            }
        }

        // TODO: Could emit event for manager to handle required undelegation
    }

    /**
     * @dev Get lock period from Staking contract
     */
    function _getLockPeriod() internal view returns (uint256) {
        // Get lock period from Staking contract through StakingManager
        // For now, return a default value - will need to implement proper access
        return 28 days; // Default SubQuery unbonding period
    }

    /**
     * @dev Remove indexer from active list if delegation is zero
     */
    function _cleanupIndexerIfEmpty(address _indexer) internal {
        if (delegatedToIndexer[_indexer] == 0 && isActiveIndexer[_indexer]) {
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
}
