// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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

    event AddVestingPlan(
        uint256 planId,
        uint256 lockPeriod,
        uint256 vestingPeriod,
        uint256 initialUnlockPercent
    );

    constructor(address _token) Ownable() {
        require(_token != address(0x0), "invalid token address");
        token = _token;
    }

    function addVestingPlan(
        uint256 _lockPeriod,
        uint256 _vestingPeriod,
        uint256 _initialUnlockPercent
    ) public onlyOwner {
        require(
            _initialUnlockPercent <= 100,
            "initial unlock percent should be equal or less than 100"
        );
        plans.push(
            VestingPlan(_lockPeriod, _vestingPeriod, _initialUnlockPercent)
        );

        // emit event for vesting plan addition
        emit AddVestingPlan(
            plans.length - 1,
            _lockPeriod,
            _vestingPeriod,
            _initialUnlockPercent
        );
    }

    function allocateVesting(
        address addr,
        uint256 _planId,
        uint256 _allocation
    ) public onlyOwner {
        require(addr != address(0x0), "empty address is not allowed");
        require(
            allocations[addr] == 0,
            "vesting is already set on the account"
        );
        require(_allocation > 0, "zero amount vesting is not allowed");
        require(_planId < plans.length, "invalid plan id");

        userPlanId[addr] = _planId;
        allocations[addr] = _allocation;
        totalAllocation += _allocation;
    }

    function batchAllocateVesting(
        uint256 planId,
        address[] memory addrs,
        uint256[] memory _allocations
    ) external onlyOwner {
        require(addrs.length > 0, "number of addresses should be at least one");
        require(
            addrs.length == _allocations.length,
            "number of addresses should be same as number of allocations"
        );

        for (uint256 i = 0; i < addrs.length; i++) {
            allocateVesting(addrs[i], planId, _allocations[i]);
        }
    }

    function depositByAdmin(uint256 amount) external onlyOwner {
        require(amount > 0, "should deposit positive amount");
        require(
            IERC20(token).transferFrom(msg.sender, address(this), amount),
            "Vesting: transfer failure"
        );
    }

    function withdrawAllByAdmin() external onlyOwner {
        uint256 amount = IERC20(token).balanceOf(address(this));
        require(
            IERC20(token).transfer(msg.sender, amount),
            "Vesting: transfer failure"
        );
    }

    function startVesting(uint256 _vestingStartDate) external onlyOwner {
        require(
            block.timestamp < _vestingStartDate,
            "vesting start date must in the future"
        );

        vestingStartDate = _vestingStartDate;

        uint256 amount = IERC20(token).balanceOf(address(this));
        require(amount == totalAllocation, "balance not enough for allocation");

        transferOwnership(address(this));
    }

    function claim() external {
        require(
            allocations[msg.sender] != 0,
            "vesting is not set on the account"
        );

        uint256 claimAmount = claimableAmount(msg.sender);
        claimed[msg.sender] += claimAmount;
        totalClaimed += claimAmount;

        require(
            IERC20(token).transfer(msg.sender, claimAmount),
            "Vesting: transfer failure"
        );
    }

    function claimableAmount(address user) public view returns (uint256) {
        // vesting start date is not set or allocation is empty
        if (vestingStartDate == 0 || allocations[user] == 0) {
            return 0;
        }

        uint256 planId = userPlanId[user];
        VestingPlan memory plan = plans[planId];
        uint256 planStartDate = vestingStartDate + plan.lockPeriod;

        if (block.timestamp <= planStartDate) {
            return 0;
        }

        // no versting period or vesting period passed
        uint256 planCompleteDate = planStartDate + plan.vestingPeriod;
        if (plan.vestingPeriod == 0 || block.timestamp > planCompleteDate) {
            return allocations[user] - claimed[user];
        }

        // druring plan period
        uint256 vestedPeriod = block.timestamp - planStartDate;
        uint256 initialAmount = (allocations[user] *
            plan.initialUnlockPercent) / 100;
        uint256 vestingTokens = allocations[user] - initialAmount;
        return
            initialAmount +
            (vestingTokens * vestedPeriod) /
            plan.vestingPeriod -
            claimed[user];
    }
}
