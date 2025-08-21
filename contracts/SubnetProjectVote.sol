// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/ISettings.sol';
import './utils/SQParameter.sol';

/**
 * @title SubnetProjectVote
 * @notice A voting contract that allows users to vote for projects using SQT tokens
 * @dev This contract enables users to:
 * - Vote for specific projects by sending SQT tokens to the contract
 * - Withdraw their votes at any time without any locking period
 * - Track voting activity through emitted events
 *
 * Key features:
 * - No validation of projectId existence (external validation responsibility)
 * - No time-based restrictions on voting or withdrawing
 * - Complete transparency through view functions and events
 */
contract SubnetProjectVote is Initializable, OwnableUpgradeable, SQParameter {
    using SafeERC20 for IERC20;

    /// @notice Settings contract to access SQT token address
    ISettings public settings;

    /// @notice Mapping from user address to project ID to vote amount
    /// @dev userVotes[user][projectId] = amount of SQT tokens voted by user for projectId
    mapping(address => mapping(bytes32 => uint256)) public userVotes;

    /// @notice Mapping from project ID to total votes received
    /// @dev totalVotes[projectId] = total SQT tokens voted for projectId by all users
    mapping(bytes32 => uint256) public totalVotes;

    /// @notice Alternative mapping for project-centric vote queries
    /// @dev projectUserVotes[projectId][user] = amount voted by user for projectId
    /// This provides gas-efficient queries when iterating through project voters
    mapping(bytes32 => mapping(address => uint256)) public projectUserVotes;

    /// @notice Emitted when a user votes SQT tokens for a project
    /// @param user The address of the voter
    /// @param projectId The unique identifier of the project being voted for
    /// @param amount The amount of SQT tokens voted
    event Voted(address indexed user, bytes32 indexed projectId, uint256 amount);

    /// @notice Emitted when a user withdraws their votes from a project
    /// @param user The address of the voter withdrawing
    /// @param projectId The unique identifier of the project being withdrawn from
    /// @param amount The amount of SQT tokens withdrawn
    event Withdrawn(address indexed user, bytes32 indexed projectId, uint256 amount);

    /**
     * @notice Initializes the contract with the settings address
     * @dev This function can only be called once due to the initializer modifier
     * @param _settings Address of the Settings contract that provides access to other contract addresses
     */
    function initialize(address _settings) external initializer {
        __Ownable_init();
        settings = ISettings(_settings);
    }

    /**
     * @notice Vote for a project by transferring SQT tokens to the contract
     * @dev Users must approve this contract to spend their SQT tokens before calling this function
     * @param projectId The unique identifier of the project to vote for (bytes32 hash)
     * @param amount The amount of SQT tokens to vote with (must be > 0)
     *
     * Requirements:
     * - amount must be greater than 0
     * - user must have sufficient SQT token balance
     * - user must have approved this contract to spend at least `amount` SQT tokens
     *
     * Effects:
     * - Transfers `amount` SQT tokens from user to this contract
     * - Increases user's vote count for the project
     * - Increases total vote count for the project
     * - Emits Voted event
     */
    function vote(bytes32 projectId, uint256 amount) external {
        require(amount > 0, 'Amount must be greater than 0');

        // Get SQT token contract address from settings
        IERC20 sqtToken = IERC20(settings.getContractAddress(SQContracts.SQToken));
        // Transfer SQT tokens from user to this contract
        sqtToken.safeTransferFrom(msg.sender, address(this), amount);

        // Update vote tracking state
        userVotes[msg.sender][projectId] += amount;
        totalVotes[projectId] += amount;
        projectUserVotes[projectId][msg.sender] += amount;

        emit Voted(msg.sender, projectId, amount);
    }

    /**
     * @notice Withdraw a specific amount of votes from a project
     * @dev Allows partial withdrawal of votes without any time restrictions
     * @param projectId The unique identifier of the project to withdraw votes from
     * @param amount The amount of SQT tokens to withdraw (must be > 0 and <= user's votes)
     *
     * Requirements:
     * - amount must be greater than 0
     * - user must have at least `amount` votes for the specified project
     *
     * Effects:
     * - Decreases user's vote count for the project
     * - Decreases total vote count for the project
     * - Transfers `amount` SQT tokens back to the user
     * - Emits Withdrawn event
     */
    function withdraw(bytes32 projectId, uint256 amount) external {
        require(amount > 0, 'Amount must be greater than 0');
        require(userVotes[msg.sender][projectId] >= amount, 'Insufficient votes');

        // Update vote tracking state
        userVotes[msg.sender][projectId] -= amount;
        totalVotes[projectId] -= amount;
        projectUserVotes[projectId][msg.sender] -= amount;

        // Transfer SQT tokens back to user
        IERC20 sqtToken = IERC20(settings.getContractAddress(SQContracts.SQToken));
        sqtToken.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, projectId, amount);
    }

    /**
     * @notice Withdraw all votes from a project at once
     * @dev Convenience function to withdraw entire voting position for a project
     * @param projectId The unique identifier of the project to withdraw all votes from
     *
     * Requirements:
     * - user must have votes for the specified project (amount > 0)
     *
     * Effects:
     * - Sets user's vote count for the project to 0
     * - Decreases total vote count for the project by user's full amount
     * - Transfers all user's SQT tokens for this project back to the user
     * - Emits Withdrawn event with the full amount
     */
    function withdrawAll(bytes32 projectId) external {
        uint256 amount = userVotes[msg.sender][projectId];
        require(amount > 0, 'No votes to withdraw');

        // Reset user's votes for this project to 0
        userVotes[msg.sender][projectId] = 0;
        totalVotes[projectId] -= amount;
        projectUserVotes[projectId][msg.sender] = 0;

        // Transfer all SQT tokens back to user
        IERC20 sqtToken = IERC20(settings.getContractAddress(SQContracts.SQToken));
        sqtToken.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, projectId, amount);
    }

    /**
     * @notice Get the amount of votes a user has for a specific project
     * @dev View function that doesn't modify state
     * @param user The address of the user to query
     * @param projectId The unique identifier of the project
     * @return The amount of SQT tokens the user has voted for the project
     */
    function getUserVotes(address user, bytes32 projectId) external view returns (uint256) {
        return userVotes[user][projectId];
    }

    /**
     * @notice Get the total amount of votes received by a project
     * @dev View function that returns the sum of all votes from all users for a project
     * @param projectId The unique identifier of the project
     * @return The total amount of SQT tokens voted for the project by all users
     */
    function getProjectTotalVotes(bytes32 projectId) external view returns (uint256) {
        return totalVotes[projectId];
    }

    /**
     * @notice Update the settings contract address
     * @dev Only the contract owner can call this function
     * @param _settings The new address of the Settings contract
     *
     * Requirements:
     * - Can only be called by the contract owner
     *
     * Effects:
     * - Updates the settings contract address
     * - This affects which SQT token contract is used for transfers
     */
    function setSettings(address _settings) external onlyOwner {
        settings = ISettings(_settings);
    }
}
