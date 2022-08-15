// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import './interfaces/ISettings.sol';
import './interfaces/IStaking.sol';
import './interfaces/IVesting.sol';

contract VSQToken is Initializable {
    string private _name = 'VotingSubQueryToken';
    string private _symbol = 'VSQT';
    uint8 private _decimals = 18;
    ISettings public settings;

    function initialize(ISettings _settings) external initializer {
        settings = _settings;
    }

    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function decimals() public pure returns (uint8) {
        return 18;
    }

    function balanceOf(address account) public view returns (uint256) {
        uint256 balanceAmount = IERC20(settings.getSQToken()).balanceOf(account);
        uint256 stakeAmount = IStaking(settings.getStaking()).lockedAmount(account);
        IVesting vesting = IVesting(settings.getVesting());
        uint256 vestingAmount = vesting.allocations(account) - vesting.claimed(account);
        return balanceAmount + stakeAmount + vestingAmount;
    }
}
