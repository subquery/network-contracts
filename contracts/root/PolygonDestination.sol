// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IInflationDestination} from "./IInflationDestination.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/ISettings.sol";
import "./IRootChainManager.sol";

contract PolygonDestination is IInflationDestination, Ownable, ERC165 {
    /// @dev ### STATES
    /// @notice ISettings contract which stores SubQuery network contracts address
    ISettings public settings;
    address public xcRecipient;

    constructor(ISettings _settings, address _xcRecipient) Ownable() {
        settings = _settings;
        xcRecipient = _xcRecipient;
    }

    /**
     * @notice Update setting state.
     * @param _settings ISettings contract
     */
    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    function setXcRecipient(address _xcRecipient) external onlyOwner {
        xcRecipient = _xcRecipient;
    }

    /**
     * @notice Check ERC165 interface
     * @param interfaceId interface ID
     * @return Result of support or not
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165) returns (bool) {
        return interfaceId == type(IInflationDestination).interfaceId || super.supportsInterface(interfaceId);
    }

    function afterReceiveInflatedTokens(uint256 tokenAmount) external {
        address rcManager = ISettings(settings).getContractAddress(SQContracts.RootChainManager);
        require(rcManager != address(0), "PD001");
        address sqtoken = ISettings(settings).getContractAddress(SQContracts.SQToken);
        bytes32 tokenType = IRootChainManager(rcManager).tokenToType(sqtoken);
        address predicate = IRootChainManager(rcManager).typeToPredicate(tokenType);
        ERC20(sqtoken).increaseAllowance(predicate, tokenAmount);
        bytes memory depositData = abi.encode(tokenAmount);
        IRootChainManager(rcManager).depositFor(xcRecipient, sqtoken, depositData);
    }

    function withdraw(address _token) external onlyOwner {
        uint256 amount = ERC20(_token).balanceOf(address(this));
        ERC20(_token).transfer(owner(), amount);
    }
}