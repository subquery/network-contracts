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
 * @notice Produce epochs based on a period to coordinate contracts. Staking and reward distributing are running based on Eras
 */
contract EraManager is Initializable, OwnableUpgradeable, IEraManager {
    /// @dev ### STATES
    /// @notice ISettings contract which stores SubQuery network contracts address
    ISettings public settings;

    /// @notice Era period in second
    uint256 public eraPeriod;

    /// @notice Current Era number
    uint256 public eraNumber;

    /// @notice Current era start time in unix timestamp
    uint256 public eraStartTime;

    /// @notice Maintenance mode, when maintenance mode, only owner can update
    bool public maintenance;

    /// @dev ### EVENTS
    /// @notice Emitted when admin update the eraPeriod
    event EraPeriodUpdate(uint256 indexed era, uint256 eraPeriod);

    /// @notice Emitted when new Era started
    event NewEraStart(uint256 indexed era, address caller);

    /**
     * @dev ### FUNCTIONS
     * @notice Initialize the contract to start from Era 1
     * @param _settings ISettings contract
     * @param _eraPeriod eraPeriod in seconds
     */
    function initialize(ISettings _settings, uint256 _eraPeriod) external initializer {
        __Ownable_init();
        require(_eraPeriod > 0, 'E001');

        settings = _settings;
        eraPeriod = _eraPeriod;
        eraNumber = 1;
        emit NewEraStart(eraNumber, msg.sender);
    }

    function enableMaintenance() external onlyOwner {
        maintenance = true;
    }

    function disableMaintenance() external onlyOwner {
        maintenance = false;
    }

    /**
     * @notice Start a new era if time already passed
     */
    function startNewEra() public {
        require(!maintenance, 'G019');
        require(eraStartTime + eraPeriod < block.timestamp, 'E002');

        eraNumber++;
        eraStartTime = block.timestamp;

        IInflationController inflationCtl = IInflationController(settings.getInflationController());
        if (inflationCtl.inflationRate > 0) {
            inflationCtl.mintInflatedTokens();
        }

        emit NewEraStart(eraNumber, msg.sender);
    }

    /**
     * @notice Start a new era if time already passed and return the new Era number
     * @return eraNumber New Era number
     */
    function safeUpdateAndGetEra() external returns (uint256) {
        require(!maintenance, 'G019');
        if (eraStartTime + eraPeriod < block.timestamp) {
            startNewEra();
        }
        return eraNumber;
    }

    /**
     * @notice Utility function to calculate the EraNumber from a given timestamp
     * @param timestamp A given timestamp
     * @return eraNumber The calculated Era number
     */
    function timestampToEraNumber(uint256 timestamp) external view returns (uint256) {
        require(timestamp >= eraStartTime, 'E003');
        return eraNumber + ((timestamp - eraStartTime) / eraPeriod);
    }

    /**
     * @notice Update era period -  admin only
     * @param newEraPeriod New Era Period to update
     */
    function updateEraPeriod(uint256 newEraPeriod) external onlyOwner {
        require(newEraPeriod > 0, 'E001');

        eraPeriod = newEraPeriod;

        emit EraPeriodUpdate(eraNumber, eraPeriod);
    }
}
