// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

import './interfaces/ISettings.sol';

contract Settings is ISettings, Initializable, OwnableUpgradeable {
    mapping(SQContracts => address) public contractAddresses;

    function initialize() external initializer {
        __Ownable_init();
    }

    function setContractAddress(SQContracts sq, address _address) public {
        contractAddresses[sq] = _address;
    }

    function getContractAddress(SQContracts sq) public view returns (address) {
        return contractAddresses[sq];
    }

    function setBatchAddress(SQContracts[] calldata _sq, address[] calldata _address) external {
        require(_sq.length == _address.length, 'ST001');
        for (uint256 i = 0; i < _sq.length; i++) {
            contractAddresses[_sq[i]] = _address[i];
        }
    }
}
