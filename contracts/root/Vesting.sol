// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../interfaces/ISQToken.sol';

contract Vesting is Ownable {
    using SafeERC20 for IERC20;

    struct VestingPlan {
        uint256 lockPeriod;
        uint256 vestingPeriod;
        uint256 initialUnlockPercent;
    }

    address public token;
    address public vtToken;
    uint256 public vestingStartDate;
    uint256 public totalAllocation;
    uint256 public totalClaimed;
    VestingPlan[] public plans;

    // 18 decimal: 62 + 62 = 124 bit (15.5 bytes)
    // 16 bit for planId   = 16  bit 2 bytes
    // number: 58 + 58     = 116 bit (14.5 bytes) ~= 288230,376,151,711,744
    // number + decimal    = 120 bit (15 bytes) unused 256 - 120 = 136
    mapping(address => bytes32) public allocations;

    event VestingPlanAdded(
        uint256 planId,
        uint256 lockPeriod,
        uint256 vestingPeriod,
        uint256 initialUnlockPercent
    );
    event VestingAllocated(address indexed user, uint256 planId, uint256 allocation);
    event VestingClaimed(address indexed user, uint256 amount);

    constructor(address _token, address _vtToken) Ownable() {
        require(_token != address(0x0), 'G009');
        require(_vtToken != address(0x0), 'G009');
        vtToken = _vtToken;
        token = _token;
    }

    function addVestingPlan(
        uint256 _lockPeriod,
        uint256 _vestingPeriod,
        uint256 _initialUnlockPercent
    ) public onlyOwner {
        require(_initialUnlockPercent <= 100, 'V001');
        plans.push(VestingPlan(_lockPeriod, _vestingPeriod, _initialUnlockPercent));

        // emit event for vesting plan addition
        emit VestingPlanAdded(plans.length - 1, _lockPeriod, _vestingPeriod, _initialUnlockPercent);
    }

    function allocateVesting(address user, uint256 planId, uint256 allocation) public onlyOwner {
        _saveUserAllocation(user, planId, allocation);
        totalAllocation += allocation;
    }

    function batchAllocateVesting(
        uint256[] calldata _planIds,
        address[] calldata _users,
        uint256[] calldata _allocations
    ) external onlyOwner {
        require(_users.length > 0, 'V005');
        require(_users.length == _allocations.length, 'V006');
        require(_users.length == _planIds.length, 'V006');

        uint256 _total;
        for (uint256 i = 0; i < _users.length; i++) {
            _saveUserAllocation(_users[i], _planIds[i], _allocations[i]);
            _total += _allocations[i];
        }
        totalAllocation += _total;
    }

    function withdrawAllByAdmin() external onlyOwner {
        uint256 amount = IERC20(token).balanceOf(address(this));
        require(IERC20(token).transfer(msg.sender, amount), 'V008');
    }

    function startVesting(uint256 _vestingStartDate) external onlyOwner {
        require(block.timestamp < _vestingStartDate, 'V009');

        vestingStartDate = _vestingStartDate;

        uint256 amount = IERC20(token).balanceOf(address(this));
        require(amount == totalAllocation, 'V010');

        transferOwnership(address(this));
    }

    function claim() external {
        _claim(msg.sender);
    }

    function claimFor(address user) external {
        _claim(user);
    }

    function _claim(address user) internal {
        (uint256 planId, uint256 allocation, uint256 claimed) = userAllocation(user);
        require(allocation != 0, 'V011');

        uint256 amount = claimableAmount(user);
        require(amount > 0, 'V012');

        ISQToken(vtToken).burnFrom(user, amount);

        uint256 newClaimed = claimed + amount;
        _updateUserAllocation(user, newClaimed);
        totalClaimed += amount;

        require(newClaimed <= allocation, 'V012');

        require(IERC20(token).transfer(user, amount), 'V008');
        emit VestingClaimed(user, amount);
    }

    function claimableAmount(address user) public view returns (uint256) {
        uint256 amount = unlockedAmount(user);
        uint256 vtSQTAmount = IERC20(vtToken).balanceOf(user);
        return vtSQTAmount >= amount ? amount : vtSQTAmount;
    }

    function unlockedAmount(address user) public view returns (uint256) {
        (uint256 planId, uint256 allocation, uint256 claimed) = userAllocation(user);

        // vesting start date is not set or allocation is empty
        if (vestingStartDate == 0 || allocation == 0) {
            return 0;
        }

        VestingPlan memory plan = plans[planId];
        uint256 planStartDate = vestingStartDate + plan.lockPeriod;

        if (block.timestamp <= planStartDate) {
            return 0;
        }

        // no versting period or vesting period passed
        uint256 planCompleteDate = planStartDate + plan.vestingPeriod;
        if (plan.vestingPeriod == 0 || block.timestamp > planCompleteDate) {
            return allocation - claimed;
        }

        // druring plan period
        uint256 vestedPeriod = block.timestamp - planStartDate;
        uint256 initialAmount = (allocation * plan.initialUnlockPercent) / 100;
        uint256 vestingTokens = allocation - initialAmount;
        return initialAmount + (vestingTokens * vestedPeriod) / plan.vestingPeriod - claimed;
    }

    function plansLength() external view returns (uint256) {
        return plans.length;
    }

    function userAllocation(address user) public view returns (uint256, uint256, uint256) {
        bytes32 ua = allocations[user];

        bytes32 planId = ua >> 240;
        bytes32 allocation = (ua << 16) >> 136; // 256 - 136 = 120
        bytes32 claimed = (ua << 136) >> 136;

        return (uint256(planId), uint256(allocation), uint256(claimed));
    }

    function _saveUserAllocation(address user, uint256 planId, uint256 allocation) private {
        require(user != address(0x0), 'V002');
        require(planId < plans.length, 'PM012');
        require(allocation > 0, 'V004');

        bytes32 newPlan = bytes32(planId);
        bytes32 newAllocation = bytes32(allocation << 120); // 136 - 16

        bytes memory data = new bytes(32);
        data[0] = newPlan[30];
        data[1] = newPlan[31];
        // 2 + 15
        for (uint i = 2; i < 17; i++) {
            data[i] = newAllocation[i];
        }
        allocations[user] = bytes32(data);

        ISQToken(vtToken).mint(user, allocation);
        emit VestingAllocated(user, planId, allocation);
    }

    function _updateUserAllocation(address user, uint256 claimed) private {
        bytes32 ua = allocations[user];
        bytes32 newClaimed = bytes32(claimed);

        bytes memory data = new bytes(32);
        for (uint i = 0; i < 17; i++) {
            data[i] = ua[i];
        }
        for (uint i = 17; i < 32; i++) {
            data[i] = newClaimed[i];
        }

        allocations[user] = bytes32(data);
    }
}
