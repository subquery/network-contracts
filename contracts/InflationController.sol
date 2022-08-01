// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import './interfaces/IInflationDestination.sol';
import './interfaces/ISettings.sol';
import './interfaces/ISQToken.sol';
import './interfaces/IEraManager.sol';
import './Constants.sol';
import './utils/MathUtil.sol';

contract InflationController is Initializable, OwnableUpgradeable, Constants {
    using MathUtil for uint256;

    ISettings public settings;
    uint256 public inflationRate;
    address public inflationDestination;

    uint256 public lastInflationTimestamp;

    //uint256 private constant BASIS_POINTS = 10e4;
    //uint256 private constant PER_BILL = 10e9;
    // second for the Julian year
    uint256 private constant YEAR_SECONDS = (3600 * 24 * 36525) / 100;

    function initialize(
        ISettings _settings,
        uint256 _inflationRate,
        address _inflationDestination
    ) external initializer {
        __Ownable_init();
        require(_inflationRate < PER_MILL, 'InflationRate value is out of range');

        settings = _settings;
        inflationRate = _inflationRate;
        inflationDestination = _inflationDestination;
        lastInflationTimestamp = block.timestamp;
    }

    function setInflationRate(uint256 _inflationRate) external onlyOwner {
        require(_inflationRate < PER_MILL, 'InflationRate value is out of range');
        inflationRate = _inflationRate;
    }

    function setInflationDestination(address _inflationDestination) external onlyOwner {
        inflationDestination = _inflationDestination;
    }

    function mintInflatedTokens() external {
        require(msg.sender == settings.getEraManager(), 'Can only be called by eraManager');
        //IEraManager eraManager = IEraManager(settings.getEraManager());
        uint256 passedTime = block.timestamp - lastInflationTimestamp;
        require(passedTime > 0, 'Already minted this Era');

        uint256 passedTimeRate = MathUtil.mulDiv(passedTime * inflationRate, PER_BILL / PER_MILL, YEAR_SECONDS);
        lastInflationTimestamp = block.timestamp;

        address sqToken = settings.getSQToken();
        uint256 totalSupply = IERC20(sqToken).totalSupply();
        uint256 newSupply = (totalSupply * (PER_BILL + passedTimeRate)) / PER_BILL;
        uint256 claimAmount = newSupply - totalSupply;
        ISQToken(sqToken).mint(inflationDestination, claimAmount);
        if (AddressUpgradeable.isContract(inflationDestination)) {
            IInflationDestination(inflationDestination).afterReceiveInflatedTokens(claimAmount);
        }
    }
}
