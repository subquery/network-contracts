// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

interface IEraManager {
    function eraStartTime() external view returns (uint256);

    function eraPeriod() external view returns (uint256);

    function eraNumber() external view returns (uint256);

    function safeUpdateAndGetEra() external returns (uint256);

    function timestampToEraNumber(uint256 timestamp) external view returns (uint256);
}
