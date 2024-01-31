// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.15;

import '@openzeppelin/contracts/utils/introspection/ERC165.sol';
import { IInflationDestination } from '../root/IInflationDestination.sol';

contract MockInflationDestination is IInflationDestination, ERC165 {
    event HookCalled();
    constructor() {}

    /**
     * @notice Check ERC165 interface
     * @param interfaceId interface ID
     * @return Result of support or not
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165) returns (bool) {
        return interfaceId == type(IInflationDestination).interfaceId || super.supportsInterface(interfaceId);
    }

    function afterReceiveInflatedTokens(uint256 tokenAmount) external {
        emit HookCalled();
    }
}
