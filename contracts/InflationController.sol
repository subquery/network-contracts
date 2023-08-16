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

/**
 * @title InflationController contract
 * @notice The InflationController contract mint the inflation SQT token to a set address at a set inflation rate. It also provide the manual way to mint SQT Token to admin.
 */
contract InflationController is Initializable, OwnableUpgradeable, Constants {
    using MathUtil for uint256;

    /// @dev ### STATES
    /// @notice ISettings contract which stores SubQuery network contracts address
    ISettings public settings;

    /// @notice The one year inflation rate for SQT token
    uint256 public inflationRate;

    /// @notice The address to recevie the inflation SQT token
    address public inflationDestination;

    /// @notice Last inflation timestamp
    uint256 public lastInflationTimestamp;

    /// @notice Seconds for the Julian year
    uint256 private constant YEAR_SECONDS = (3600 * 24 * 36525) / 100;

    /**
     * @dev ### FUNCTIONS
     * @notice Initialize the contract to setup parameters: inflationRate, inflationDestination, lastInflationTimestamp
     * @param _settings ISettings contract
     * @param _inflationRate One year inflationRate for SQT token
     * @param _inflationDestination Address to receive the inflation SQT token
     */
    function initialize(
        ISettings _settings,
        uint256 _inflationRate,
        address _inflationDestination
    ) external initializer {
        __Ownable_init();
        require(_inflationRate < PER_MILL, 'IC001');

        settings = _settings;
        inflationRate = _inflationRate;
        inflationDestination = _inflationDestination;
        lastInflationTimestamp = block.timestamp;
    }

    /**
     * @notice Update setting state.
     * @param _settings ISettings contract
     */
    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    /**
     * @notice Set the inflation rate
     * @param _inflationRate One year inflationRate for SQT token
     */
    function setInflationRate(uint256 _inflationRate) external onlyOwner {
        require(_inflationRate < PER_MILL, 'IC001');
        inflationRate = _inflationRate;
    }

    /**
     * @notice Set the address to receive the inflation SQT token
     * @param _inflationDestination Address to receive the inflation SQT token
     */
    function setInflationDestination(address _inflationDestination) external onlyOwner {
        inflationDestination = _inflationDestination;
    }

    /**
     * @notice Can only called by eraManager when startNewEra, it will calculate and mint the inflation SQT token for last Era according to the inflation rate.
     */
    function mintInflatedTokens() external {
        require(msg.sender == settings.getEraManager(), 'G012');
        uint256 passedTime = block.timestamp - lastInflationTimestamp;
        require(passedTime > 0, 'IC002');

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

    /**
     * @notice Can only called by admin account to mint the specified amount of SQT token.
     * @param _destination Address to receive the minted SQT token
     * @param _amount amount SQT token to mint
     */
    function mintSQT(address _destination, uint256 _amount) external onlyOwner {
        ISQToken(settings.getSQToken()).mint(_destination, _amount);
    }
}
