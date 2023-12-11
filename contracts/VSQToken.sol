// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import './interfaces/ISettings.sol';
import './interfaces/IStaking.sol';
import './interfaces/IVesting.sol';

contract VSQToken is Initializable, OwnableUpgradeable {
    string private _name = 'VotingSubQueryToken';
    string private _symbol = 'VSQT';
    uint8 private _decimals = 18;
    ISettings public settings;

    function initialize(ISettings _settings) external initializer {
        __Ownable_init();
        settings = _settings;
    }

    /**
     * @notice Update setting state.
     * @param _settings ISettings contract
     */
    function setSettings(ISettings _settings) external onlyOwner {
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
        uint256 balanceAmount = IERC20(settings.getContractAddress(SQContracts.SQToken)).balanceOf(account);
        uint256 stakeAmount = IStaking(settings.getContractAddress(SQContracts.Staking)).lockedAmount(account);
        // TODO: vesting may not live on child network
        IVesting vesting = IVesting(settings.getContractAddress(SQContracts.Vesting));
        uint256 returnBalance = balanceAmount + stakeAmount;
        if (address(vesting) != address(0)) {
            uint256 vestingAmount = vesting.allocations(account) - vesting.claimed(account);
            returnBalance = returnBalance + vestingAmount;
        }
        return returnBalance;
    }
}
