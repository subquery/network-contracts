// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

//import '@openzeppelin/contracts/utils/introspection/IERC165.sol';

interface IConsumer {
    function getSigner() external view returns (address);

    // Params: channel id, msg sender, amount, callback info.
    function paid(
        uint256 channelId,
        uint256 amount,
        bytes memory callback
    ) external;

    // Params: channel id, msg sender, amount.
    function claimed(uint256 channelId, uint256 amount) external;
}
