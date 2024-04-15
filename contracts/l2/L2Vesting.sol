// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../interfaces/ISQToken.sol';
import '../interfaces/ISettings.sol';

contract L2Vesting is Initializable, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    /// @notice Vesting plan
    struct VestingPlan {
        uint256 lockPeriod;
        uint256 vestingPeriod;
        uint256 initialUnlockPercent;
        uint256 startDate;
        uint256 totalAllocation;
        uint256 totalClaimed;
    }

    ISettings public settings;

    //    /// @notice token for vesting
    //    address public token;
    /// @notice vesting plans
    VestingPlan[] public plans;

    /// @notice allovation ammout for user by planId: planId => user => amount
    mapping(uint256 => mapping(address => uint256)) public allocations;
    /// @notice claimed amount for user by planId: planId => user => amount
    mapping(uint256 => mapping(address => uint256)) public claimed;

    /**
     * @dev Emitted when a new vesting plan is added
     */
    event VestingPlanAdded(
        uint256 planId,
        uint256 lockPeriod,
        uint256 vestingPeriod,
        uint256 initialUnlockPercent
    );
    /**
     * @dev Emitted when a new vesting allocation is added to a user by planId
     */
    event VestingAllocated(address indexed user, uint256 planId, uint256 allocation);
    /**
     * @dev Emitted when a user claims vested tokens
     */
    event VestingClaimed(address indexed user, uint256 planId, uint256 amount);

    /**
     * @dev Initialize this contract.
     */
    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        // Settings
        settings = _settings;
    }

    /**
     * @notice Update setting state.
     * @param _settings ISettings contract
     */
    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    function addVestingPlan(
        uint256 _lockPeriod,
        uint256 _vestingPeriod,
        uint256 _initialUnlockPercent
    ) public onlyOwner {
        require(_initialUnlockPercent <= 100, 'V001');
        plans.push(VestingPlan(_lockPeriod, _vestingPeriod, _initialUnlockPercent, 0, 0, 0));

        // emit event for vesting plan addition
        emit VestingPlanAdded(plans.length - 1, _lockPeriod, _vestingPeriod, _initialUnlockPercent);
    }

    function _allocateVesting(address addr, uint256 planId, uint256 allocation) internal {
        require(addr != address(0x0), 'V002');
        //        require(allocations[planId][addr] == 0, 'V003');
        require(allocation > 0, 'V004');
        require(planId < plans.length, 'V013');

        //        userPlanId[addr] = planId;
        allocations[planId][addr] += allocation;

        emit VestingAllocated(addr, planId, allocation);
    }

    function batchAllocateVesting(
        uint256[] calldata _planIds,
        address[] calldata _addrs,
        uint256[] calldata _allocations
    ) external onlyOwner {
        require(_addrs.length > 0, 'V005');
        require(_addrs.length == _allocations.length, 'V006');
        require(_addrs.length == _planIds.length, 'V006');

        for (uint256 i = 0; i < _addrs.length; i++) {
            _allocateVesting(_addrs[i], _planIds[i], _allocations[i]);

            unchecked {
                plans[_planIds[i]].totalAllocation += _allocations[i];
            }
        }
    }

    function withdrawAllByAdmin() external onlyOwner {
        uint256 amount = _token().balanceOf(address(this));
        require(_token().transfer(msg.sender, amount), 'V008');
    }

    function startVesting(uint256 _planId, uint256 _vestingStartDate) external onlyOwner {
        //        require(block.timestamp < _vestingStartDate, 'V009');
        plans[_planId].startDate = _vestingStartDate;
        //        vestingStartDate = _vestingStartDate;
        //
        //        uint256 amount = IERC20(token).balanceOf(address(this));
        //        require(amount == totalAllocation, 'V010');
    }

    function claim(uint256 planId) external {
        _claim(planId, msg.sender);
    }

    function claimFor(uint256 planId, address account) external {
        _claim(planId, account);
    }

    function _claim(uint256 planId, address account) internal {
        require(planId < plans.length, 'V013');
        require(allocations[planId][account] != 0, 'V011');

        uint256 amount = claimableAmount(planId, account);
        require(amount > 0, 'V012');

        claimed[planId][account] += amount;
        plans[planId].totalClaimed += amount;

        require(claimed[planId][account] <= allocations[planId][account], 'V012');

        require(_token().transfer(account, amount), 'V008');
        emit VestingClaimed(account, planId, amount);
    }

    function claimableAmount(uint256 planId, address user) public view returns (uint256) {
        return unlockedAmount(planId, user);
    }

    function unlockedAmount(uint256 planId, address user) public view returns (uint256) {
        VestingPlan memory plan = plans[planId];
        // vesting start date is not set or allocation is empty
        uint256 vestingStartDate = plan.startDate;
        if (vestingStartDate == 0 || allocations[planId][user] == 0) {
            return 0;
        }

        uint256 planStartDate = vestingStartDate + plan.lockPeriod;

        if (block.timestamp <= planStartDate) {
            return 0;
        }

        // no versting period or vesting period passed
        uint256 planCompleteDate = planStartDate + plan.vestingPeriod;
        if (plan.vestingPeriod == 0 || block.timestamp > planCompleteDate) {
            return allocations[planId][user] - claimed[planId][user];
        }

        // druring plan period
        uint256 vestedPeriod = block.timestamp - planStartDate;
        uint256 initialAmount = (allocations[planId][user] * plan.initialUnlockPercent) / 100;
        uint256 vestingTokens = allocations[planId][user] - initialAmount;
        return
            initialAmount +
            (vestingTokens * vestedPeriod) /
            plan.vestingPeriod -
            claimed[planId][user];
    }

    function plansLength() external view returns (uint256) {
        return plans.length;
    }

    function _token() internal returns (IERC20) {
        return IERC20(settings.getContractAddress(SQContracts.SQToken));
    }
}
