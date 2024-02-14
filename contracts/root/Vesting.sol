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

    struct UserAllocation {
        uint64 planId;
        uint256 allocation;
        uint256 claimed;
    }

    struct StorageUserAllocation {
        uint64 planId;
        uint64 allocation;
        uint128 claimed;
    }

    uint256 constant SCALE_FACTOR = 1e12;

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
    mapping(address => StorageUserAllocation) private allocations;

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

    //    function allocateVesting(address user, uint64 planId, uint64 allocation) public onlyOwner {
    //        _saveUserAllocation(user, planId, allocation);
    //        totalAllocation += allocation;
    //    }

    function batchAllocateVesting(
        uint64[] calldata _planIds,
        address[] calldata _users,
        uint64[] calldata _allocations
    ) external onlyOwner {
        require(_users.length > 0, 'V005');
        require(_users.length == _allocations.length, 'V006');
        require(_users.length == _planIds.length, 'V006');

        uint256 _total;
        for (uint256 i = 0; i < _users.length; i++) {
            _total += _saveUserAllocation(_users[i], _planIds[i], _allocations[i]);
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
        UserAllocation memory ua = userAllocation(user);
        require(ua.allocation != 0, 'V011');

        uint128 scaledAmount = _claimableAmount(user);
        require(scaledAmount > 0, 'V012');
        uint256 fullAmount = uint256(scaledAmount) * SCALE_FACTOR;
        require(ua.claimed + fullAmount <= ua.allocation, 'V012');

        _updateUserAllocation(user, scaledAmount);
        ISQToken(vtToken).burnFrom(user, fullAmount);

        totalClaimed += fullAmount;

        require(IERC20(token).transfer(user, fullAmount), 'V008');
        emit VestingClaimed(user, fullAmount);
    }

    function claimableAmount(address user) public view returns (uint256) {
        return uint256(_claimableAmount(user)) * SCALE_FACTOR;
    }

    function _claimableAmount(address user) internal view returns (uint128) {
        uint256 amount = unlockedAmount(user);
        uint256 vtSQTAmount = IERC20(vtToken).balanceOf(user);
        uint256 claimable = vtSQTAmount >= amount ? amount : vtSQTAmount;
        return uint128(claimable / SCALE_FACTOR);
    }

    function unlockedAmount(address user) public view returns (uint256) {
        UserAllocation memory ua = userAllocation(user);

        // vesting start date is not set or allocation is empty
        if (vestingStartDate == 0 || ua.allocation == 0) {
            return 0;
        }

        VestingPlan memory plan = plans[ua.planId];
        uint256 planStartDate = vestingStartDate + plan.lockPeriod;

        if (block.timestamp <= planStartDate) {
            return 0;
        }

        // no versting period or vesting period passed
        uint256 planCompleteDate = planStartDate + plan.vestingPeriod;
        if (plan.vestingPeriod == 0 || block.timestamp > planCompleteDate) {
            return ua.allocation - ua.claimed;
        }

        // druring plan period
        uint256 vestedPeriod = block.timestamp - planStartDate;
        uint256 initialAmount = (ua.allocation * plan.initialUnlockPercent) / 100;
        uint256 vestingTokens = ua.allocation - initialAmount;
        return initialAmount + (vestingTokens * vestedPeriod) / plan.vestingPeriod - ua.claimed;
    }

    function plansLength() external view returns (uint256) {
        return plans.length;
    }

    function userAllocation(address user) public view returns (UserAllocation memory) {
        StorageUserAllocation memory ua = allocations[user];

        uint256 allocation = uint256(ua.allocation) * SCALE_FACTOR;
        uint256 claimed = uint256(ua.claimed) * SCALE_FACTOR;

        return UserAllocation(ua.planId, allocation, claimed);
    }

    function _saveUserAllocation(
        address user,
        uint64 planId,
        uint64 allocation
    ) private returns (uint256) {
        StorageUserAllocation storage ua = allocations[user];

        require(user != address(0x0), 'V002');
        require(ua.allocation == 0, 'V003');
        require(planId < plans.length, 'PM012');
        require(allocation > 0, 'V004');
        //        require(allocation / 1e18 < 18446744073709551616, 'V005'); // 2 ** 64

        ua.planId = planId;
        ua.allocation = allocation;

        uint256 fullLengthAllocation = uint256(allocation) * SCALE_FACTOR;

        ISQToken(vtToken).mint(user, fullLengthAllocation);
        emit VestingAllocated(user, planId, fullLengthAllocation);
        return fullLengthAllocation;
    }

    function _updateUserAllocation(address user, uint128 amount) private {
        StorageUserAllocation storage ua = allocations[user];
        ua.claimed += amount;
    }
}
