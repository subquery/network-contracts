// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import './interfaces/ISQTGift.sol';

contract SQTGift is
    Initializable,
    OwnableUpgradeable,
    ERC721Upgradeable,
    ERC721URIStorageUpgradeable,
    ERC721EnumerableUpgradeable,
    ISQTGift
{
    uint256 public nextSeriesId;

    /// @notice seriesId => GiftSeries
    mapping(uint256 => GiftSeries) public series;

    /// @notice account => seriesId => gift count
    mapping(address => mapping(uint256 => uint8)) public allowlist;

    /// @notice tokenId => Gift
    mapping(uint256 => Gift) public gifts;

    event AllowListAdded(address indexed account, uint256 indexed seriesId, uint8 amount);
    event AllowListRemoved(address indexed account, uint256 indexed seriesId, uint8 amount);

    event SeriesCreated(uint256 indexed seriesId, uint256 maxSupply, string tokenURI);
    event SeriesActiveUpdated(uint256 indexed seriesId, bool active);

    event GiftMinted(
        address indexed to,
        uint256 indexed seriesId,
        uint256 indexed tokenId,
        string tokenURI
    );

    function initialize() external initializer {
        __Ownable_init();
        __ERC721_init('SQT Gift', 'SQTG');
        __ERC721URIStorage_init();
        __ERC721Enumerable_init();
    }

    function batchAddToAllowlist(
        uint256[] calldata _seriesId,
        address[] calldata _address,
        uint8[] calldata _amount
    ) public onlyOwner {
        require(_seriesId.length == _address.length, 'SQG003');
        require(_seriesId.length == _amount.length, 'SQG003');
        for (uint256 i = 0; i < _seriesId.length; i++) {
            addToAllowlist(_seriesId[i], _address[i], _amount[i]);
        }
    }

    function addToAllowlist(uint256 _seriesId, address _address, uint8 _amount) public onlyOwner {
        require(series[_seriesId].maxSupply > 0, 'SQG001');
        allowlist[_address][_seriesId] += _amount;

        emit AllowListAdded(_address, _seriesId, _amount);
    }

    function removeFromAllowlist(
        uint256 _seriesId,
        address _address,
        uint8 _amount
    ) public onlyOwner {
        require(series[_seriesId].maxSupply > 0, 'SQG001');
        require(allowlist[_address][_seriesId] >= _amount, 'SQG002');
        allowlist[_address][_seriesId] -= _amount;

        emit AllowListRemoved(_address, _seriesId, _amount);
    }

    function createSeries(uint256 _maxSupply, string memory _tokenURI) external onlyOwner {
        require(_maxSupply > 0, 'SQG006');
        series[nextSeriesId] = GiftSeries({
            maxSupply: _maxSupply,
            totalSupply: 0,
            active: true,
            tokenURI: _tokenURI
        });

        emit SeriesCreated(nextSeriesId, _maxSupply, _tokenURI);

        nextSeriesId += 1;
    }

    function setSeriesActive(uint256 _seriesId, bool _active) external onlyOwner {
        require(series[_seriesId].maxSupply > 0, 'SQG001');
        series[_seriesId].active = _active;

        emit SeriesActiveUpdated(_seriesId, _active);
    }

    function setMaxSupply(uint256 _seriesId, uint256 _maxSupply) external onlyOwner {
        require(_maxSupply > 0, 'SQG006');
        series[_seriesId].maxSupply = _maxSupply;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(
            IERC165Upgradeable,
            ERC721Upgradeable,
            ERC721EnumerableUpgradeable,
            ERC721URIStorageUpgradeable
        )
        returns (bool)
    {
        return interfaceId == type(ISQTGift).interfaceId || super.supportsInterface(interfaceId);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721Upgradeable, ERC721URIStorageUpgradeable) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function _burn(
        uint256 tokenId
    ) internal override(ERC721Upgradeable, ERC721URIStorageUpgradeable) {
        super._burn(tokenId);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return 'ipfs://';
    }

    function mint(uint256 _seriesId) public {
        GiftSeries memory giftSerie = series[_seriesId];
        require(giftSerie.active, 'SQG004');
        require(allowlist[msg.sender][_seriesId] > 0, 'SQG002');

        require(giftSerie.totalSupply < giftSerie.maxSupply, 'SQG005');
        series[_seriesId].totalSupply += 1;

        uint256 tokenId = totalSupply() + 1;
        gifts[tokenId].seriesId = _seriesId;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, giftSerie.tokenURI);

        allowlist[msg.sender][_seriesId]--;

        emit GiftMinted(msg.sender, _seriesId, tokenId, giftSerie.tokenURI);
    }

    function batchMint(uint256 _seriesId) external {
        GiftSeries memory giftSerie = series[_seriesId];
        require(giftSerie.active, 'SQG004');
        uint8 allowAmount = allowlist[msg.sender][_seriesId];
        require(allowAmount > 0, 'SQG002');
        for (uint256 i = 0; i < allowAmount; i++) {
            mint(_seriesId);
        }
    }

    function getSeries(uint256 tokenId) external view returns (uint256) {
        return gifts[tokenId].seriesId;
    }
}
