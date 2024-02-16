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

    mapping(uint256 => mapping(address => uint256)) public allocations;
    mapping(uint256 => mapping(address => uint256)) public claimed;

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

    function _allocateVesting(address addr, uint256 planId, uint256 allocation) internal {
        require(addr != address(0x0), 'V002');
        require(allocations[planId][addr] == 0, 'V003');
        require(allocation > 0, 'V004');
        require(planId < plans.length, 'V013');

        //        userPlanId[addr] = planId;
        allocations[planId][addr] = allocation;

        ISQToken(vtToken).mint(addr, allocation);

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

        uint256 _total;
        for (uint256 i = 0; i < _addrs.length; i++) {
            _allocateVesting(_addrs[i], _planIds[i], _allocations[i]);

            unchecked {
                _total += _allocations[i];
            }
        }

        unchecked {
            totalAllocation += _total;
        }
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

        ISQToken(vtToken).burnFrom(account, amount);
        claimed[planId][account] += amount;
        totalClaimed += amount;

        require(claimed[planId][account] <= allocations[planId][account], 'V012');

        require(IERC20(token).transfer(account, amount), 'V008');
        emit VestingClaimed(account, amount);
    }

    function claimableAmount(uint256 planId, address user) public view returns (uint256) {
        uint256 amount = unlockedAmount(planId, user);
        uint256 vtSQTAmount = IERC20(vtToken).balanceOf(user);
        return vtSQTAmount >= amount ? amount : vtSQTAmount;
    }

    function unlockedAmount(uint256 planId, address user) public view returns (uint256) {
        // vesting start date is not set or allocation is empty
        if (vestingStartDate == 0 || allocations[planId][user] == 0) {
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
}
