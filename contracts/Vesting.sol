// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.10;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

contract Vesting is Ownable {
    using SafeERC20 for IERC20;

    struct VestingPlan {
        uint256 lockPeriod;
        uint256 vestingPeriod;
        uint256 initialUnlockPercent;
    }

    address public token;
    uint256 public vestingStartDate;
    VestingPlan[] public plans;

    mapping(address => uint256) public userPlanId;
    mapping(address => uint256) public allocations;
    mapping(address => uint256) public claimed;
    uint256 public totalAllocation;
    uint256 public totalClaimed;

    event AddVestingPlan(uint256 planId, uint256 lockPeriod, uint256 vestingPeriod, uint256 initialUnlockPercent);

    constructor(address token_) Ownable() {
        require(token_ != address(0x0), 'invalid token address');
        token = token_;
    }

    function setVestingStartDate(uint256 vestingStartDate_) external onlyOwner {
        require(vestingStartDate_ != 0, 'cannot set to zero vesting start date');
        require(
            (block.timestamp < vestingStartDate || vestingStartDate == 0) && block.timestamp < vestingStartDate_,
            'cannot reset vesting start date after vesting start'
        );
        vestingStartDate = vestingStartDate_;
    }

    function addVestingPlan(
        uint256 lockPeriod_,
        uint256 vestingPeriod_,
        uint256 initialUnlockPercent_
    ) public onlyOwner {
        require(initialUnlockPercent_ <= 100, 'initial unlock percent should be equal or less than 100');
        plans.push(VestingPlan(lockPeriod_, vestingPeriod_, initialUnlockPercent_));

        // emit event for vesting plan addition
        emit AddVestingPlan(plans.length - 1, lockPeriod_, vestingPeriod_, initialUnlockPercent_);
    }

    function allocateVesting(
        address addr,
        uint256 planId_,
        uint256 allocation_
    ) public onlyOwner {
        require(addr != address(0x0), 'empty address is not allowed');
        require(allocations[addr] == 0, 'vesting is already set on the account');
        require(allocation_ > 0, 'zero amount vesting is not allowed');
        require(planId_ < plans.length, 'invalid plan id');

        userPlanId[addr] = planId_;
        allocations[addr] = allocation_;
        totalAllocation += allocation_;
    }

    function batchAllocateVesting(
        uint256 planId,
        address[] memory addrs,
        uint256[] memory allocations_
    ) external onlyOwner {
        require(addrs.length > 0, 'number of addresses should be at least one');
        require(addrs.length == allocations_.length, 'number of addresses should be same as number of vestingPeriods');

        for (uint256 i = 0; i < addrs.length; i++) {
            allocateVesting(addrs[i], planId, allocations_[i]);
        }
    }

    function depositByAdmin(uint256 amount) external onlyOwner {
        require(amount > 0, 'should deposit positive amount');
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), 'Vesting: transfer failure');
    }

    function withdrawAllByAdmin() external onlyOwner {
        uint256 amount = IERC20(token).balanceOf(address(this));
        require(IERC20(token).transfer(msg.sender, amount), 'Vesting: transfer failure');
    }

    function claimableAmount(address addr) public view returns (uint256) {
        uint256 planId = userPlanId[addr];
        VestingPlan memory plan = plans[planId];

        // vesting start date is not set
        if (vestingStartDate == 0) {
            return 0;
        }

        if (allocations[addr] == 0) {
            return 0;
        }

        uint256 planStartDate = vestingStartDate + plan.lockPeriod;

        if (block.timestamp <= planStartDate) {
            return 0;
        }

        if (plan.vestingPeriod == 0) {
            return allocations[addr] - claimed[addr];
        }

        if (block.timestamp <= planStartDate + plan.vestingPeriod) {
            uint256 vestedPeriod = block.timestamp - planStartDate;
            uint256 initialAmount = (allocations[addr] * plan.initialUnlockPercent) / 100;
            uint256 vestingTokens = allocations[addr] - initialAmount;
            return initialAmount + (vestingTokens * vestedPeriod) / plan.vestingPeriod - claimed[addr];
        }

        return allocations[addr] - claimed[addr];
    }

    function claim() external {
        require(allocations[msg.sender] != 0, 'vesting is not set on the account');

        uint256 claimAmount = claimableAmount(msg.sender);
        claimed[msg.sender] += claimAmount;
        totalClaimed += claimAmount;

        require(IERC20(token).transfer(msg.sender, claimAmount), 'Vesting: transfer failure');
    }
}
