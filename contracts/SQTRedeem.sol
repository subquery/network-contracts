// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import './interfaces/ISQTGift.sol';

contract SQTRedeem is Initializable, OwnableUpgradeable {
    address public sqtoken;

    /// @notice redeemable status of the contract
    bool public redeemable;

    /// @notice nft address => seriesId => redeemable amount for each NFT in the series
    mapping(address => mapping(uint256 => uint256)) public redeemableAmount;

    event SQTRedeemed(
        address indexed to,
        uint256 indexed tokenId,
        uint256 seriesId,
        address nft,
        uint256 sqtValue
    );

    function initialize(address _sqtoken) external initializer {
        __Ownable_init();

        sqtoken = _sqtoken;
    }

    function deposit(uint256 amount) public onlyOwner {
        require(IERC20(sqtoken).transferFrom(msg.sender, address(this), amount), 'SQR001');
    }

    function withdraw(uint256 amount) public onlyOwner {
        require(IERC20(sqtoken).transfer(msg.sender, amount), 'SQR001');
    }

    function setRedeemable(bool _redeemable) external onlyOwner {
        redeemable = _redeemable;
    }

    function setRedeemableAmount(address nft, uint256 seriesId, uint256 amount) public onlyOwner {
        // this is to set the redeemable amount for per NFT in the series
        redeemableAmount[nft][seriesId] = amount;
    }

    function redeem(address nft, uint256 tokenId) public {
        require(redeemable, 'SQR002');

        IERC165Upgradeable nftContract = IERC165Upgradeable(nft);
        require(nftContract.supportsInterface(type(ISQTGift).interfaceId), 'SQR003');

        ISQTGift sqtGift = ISQTGift(nft);
        require(sqtGift.ownerOf(tokenId) == msg.sender, 'SQR005');

        uint256 seriesId = sqtGift.getSeries(tokenId);
        uint256 sqtValue = redeemableAmount[nft][seriesId];
        require(sqtValue > 0, 'SQR004');

        require(IERC20(sqtoken).transfer(msg.sender, sqtValue), 'SQR001');

        emit SQTRedeemed(msg.sender, tokenId, seriesId, nft, sqtValue);
    }

    function batchRedeem(address[] calldata _nfts, uint256[] calldata _tokenIds) public {
        require(_nfts.length == _tokenIds.length, 'G020');
        for (uint256 i = 0; i < _nfts.length; i++) {
            redeem(_nfts[i], _tokenIds[i]);
        }
    }
}
