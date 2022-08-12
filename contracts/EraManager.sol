// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/IEraManager.sol';
import './interfaces/ISettings.sol';
import './interfaces/IInflationController.sol';

/**
 * @title EraManager contract
 * @dev Produce epochs based on a period to coordinate contracts
 */
contract EraManager is Initializable, OwnableUpgradeable, IEraManager {
    ISettings public settings;
    uint256 public eraPeriod; // era period
    uint256 public eraNumber; // current era number
    uint256 public eraStartTime; // current era start time

    event EraPeriodUpdate(uint256 indexed era, uint256 eraPeriod);
    event NewEraStart(uint256 indexed era, address caller);

    function initialize(ISettings _settings, uint256 _eraPeriod) external initializer {
        __Ownable_init();
        require(_eraPeriod > 0, 'eraPeriod can not be 0');

        settings = _settings;
        eraPeriod = _eraPeriod;
        // Emit start of era 1
        eraNumber = 1;
        emit NewEraStart(eraNumber, msg.sender);
    }

    /**
     * @dev Start a new era if time already passed - anyone can call it
     */
    function startNewEra() public {
        require(eraStartTime + eraPeriod < block.timestamp, 'Current era is still active');

        eraNumber++;
        eraStartTime = block.timestamp;

        IInflationController inflationCtl = IInflationController(settings.getInflationController());
        inflationCtl.mintInflatedTokens();

        emit NewEraStart(eraNumber, msg.sender);
    }

    function safeUpdateAndGetEra() external returns (uint256) {
        if (eraStartTime + eraPeriod < block.timestamp) {
            startNewEra();
        }
        return eraNumber;
    }

    function timestampToEraNumber(uint256 timestamp) external view returns (uint256) {
        require(timestamp >= eraStartTime, 'only further timestamp available');
        return eraNumber + ((timestamp - eraStartTime) / eraPeriod);
    }

    /**
     * @dev Update era period - only admin can call it
     */
    function updateEraPeriod(uint256 newEraPeriod) external onlyOwner {
        require(newEraPeriod > 0, 'new era can not be 0');

        eraPeriod = newEraPeriod;

        emit EraPeriodUpdate(eraNumber, eraPeriod);
    }
}
