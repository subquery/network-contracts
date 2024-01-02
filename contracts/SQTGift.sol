// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import './interfaces/ISQTGift.sol';

contract SQTGift is Initializable, OwnableUpgradeable, ERC721Upgradeable, ERC721URIStorageUpgradeable, ERC721EnumerableUpgradeable, ISQTGift {
  
  address public sqtoken;
  address public redeemer;
  uint256 public seriesId;

  /// @notice seriesId => GiftSeries
  mapping(uint256 => GiftSeries) public series;

  /// @notice account => seriesId => gift count
  mapping(address => mapping(uint256 => uint8)) public allowlist;

  /// @notice tokenId => Gift
  mapping(uint256 => Gift) public gifts;

  event AllownlistAdded(address indexed account, uint256 indexed seriesId);
  event AllownlistRemoved(address indexed account, uint256 indexed seriesId);

  event SeriesCreated(uint256 indexed seriesId, uint256 maxSupply, uint256 maxSQT, uint256 defaultValue, uint256 minValue, uint256 maxValue, string tokenURI);
  event SeriesRedeemableUpdated(uint256 indexed seriesId, bool redeemable);
  event SeriesActiveUpdated(uint256 indexed seriesId, bool active);

  event GiftMinted(address indexed to, uint256 indexed seriesId, uint256 indexed tokenId, string tokenURI, uint256 sqtValue);

  function initialize(address _sqtoken) external initializer {
    __Ownable_init();
    __ERC721_init("SQT Gift", "SQTG");
    __ERC721URIStorage_init();
    __ERC721Enumerable_init();

    sqtoken = _sqtoken;
  }

  function setRedeemer(address _redeemer) external onlyOwner {
    redeemer = _redeemer;
  }

  function addToAllowlist(uint256 _seriesId, address _address) public onlyOwner {
    require(series[_seriesId].maxSupply > 0, "Series not found");
    allowlist[_address][_seriesId] += 1;

    emit AllownlistAdded(_address, _seriesId);
  }

  function removeFromAllowlist(uint256 _seriesId, address _address) public onlyOwner {
    require(series[_seriesId].maxSupply > 0, "Series not found");
    allowlist[_address][_seriesId] -= 1;

    emit AllownlistRemoved(_address, _seriesId);
  }

  function createSeries(
    uint256 _maxSupply,
    uint256 _maxSQT,
    uint256 _defaultValue,
    uint256 _minValue,
    uint256 _maxValue,
    string memory _tokenURI
  ) external onlyOwner {
    require(_maxSupply > 0, "Max supply must be greater than 0");
    require(_maxSQT > 0, "Max SQT must be greater than 0");

    if (_defaultValue == 0) {
      require(_minValue > 0, "Min value must be greater than 0");
      require(_maxValue > 0, "Max value must be greater than 0");
      require(_maxValue - _minValue > 0, "Max value must be greater than min value");
    }

    series[seriesId] = GiftSeries({
      maxSupply: _maxSupply,
      maxSQT: _maxSQT,
      defaultValue: _defaultValue,
      minValue: _minValue,
      maxValue: _maxValue,
      totalSupply: 0,
      totalRedeemableSQT: 0,
      totalRedeemedSQT: 0,
      active: true,
      redeemable: false,
      tokenURI: _tokenURI
    });

    seriesId += 1;

    emit SeriesCreated(seriesId - 1, _maxSupply, _maxSQT, _defaultValue, _minValue, _maxValue, _tokenURI);
  }

  function setSeriesRedeemable(uint256 _seriesId, bool _redeemable) external onlyOwner {
    require(series[_seriesId].maxSupply > 0, "Series not found");
    series[_seriesId].redeemable = _redeemable;

    emit SeriesRedeemableUpdated(_seriesId, _redeemable);
  }

  function setSeriesActive(uint256 _seriesId, bool _active) external onlyOwner {
    require(series[_seriesId].maxSupply > 0, "Series not found");
    series[_seriesId].active = _active;

    emit SeriesActiveUpdated(_seriesId, _active);
  }

  function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal override(
    ERC721Upgradeable, 
    ERC721EnumerableUpgradeable
  ) {
      super._beforeTokenTransfer(from, to, tokenId, batchSize);
  }

  function supportsInterface(bytes4 interfaceId) public view override(
    IERC165Upgradeable,
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721URIStorageUpgradeable
  ) returns (bool) {
    return interfaceId == type(ISQTGift).interfaceId || super.supportsInterface(interfaceId);
  }

  function tokenURI(uint256 tokenId) public view override(
    ERC721Upgradeable, 
    ERC721URIStorageUpgradeable
  ) returns (string memory) {
      return super.tokenURI(tokenId);
  }

  function _burn(uint256 tokenId) internal override(ERC721Upgradeable, ERC721URIStorageUpgradeable) {
      super._burn(tokenId);
  }

  function _baseURI() internal view virtual override returns (string memory) {
    return "ipfs://";
  }

  function _getSQTValueForTokenId(uint256 _seriesId) private view returns (uint256) {
    GiftSeries memory gift = series[_seriesId];
    if (gift.defaultValue > 0) {
      return gift.defaultValue;
    }
    
    uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp, block.difficulty, msg.sender))) % (gift.maxValue - gift.minValue + 1);
    return gift.minValue + random;
  }

  function mint(uint256 _seriesId) public {
    GiftSeries memory giftSerie = series[_seriesId];
    require(giftSerie.active, "Series not active");
    require(allowlist[msg.sender][_seriesId] > 0, "Not on allowlist");

    require(giftSerie.totalSupply < giftSerie.maxSupply, "Max gift supply reached");
    series[_seriesId].totalSupply += 1;

    uint256 tokenId = totalSupply() + 1;
    uint256 sqtValue = _getSQTValueForTokenId(_seriesId);
    series[_seriesId].totalRedeemableSQT += sqtValue;
    require(giftSerie.totalRedeemableSQT <= giftSerie.maxSQT, "Max SQT reached");
    
    gifts[tokenId].seriesId = _seriesId;
    gifts[tokenId].sqtValue = sqtValue;

    _safeMint(msg.sender, tokenId);
    _setTokenURI(tokenId, giftSerie.tokenURI);

    allowlist[msg.sender][_seriesId]--;

    emit GiftMinted(msg.sender, _seriesId, tokenId, giftSerie.tokenURI, sqtValue);
  }

  function afterTokenRedeem(uint256 tokenId) external {
    require(msg.sender == redeemer, "Not redeemer");

    Gift memory gift = gifts[tokenId];
    uint256 sqtValue = gift.sqtValue;
    series[gift.seriesId].totalRedeemedSQT += sqtValue;

    delete gifts[tokenId];
    
    _burn(tokenId);
  }

  function getGiftRedeemable(uint256 tokenId) external view returns (bool) {
    return series[gifts[tokenId].seriesId].redeemable;
  }

  function getSQTRedeemableValue(uint256 tokenId) external view returns (uint256) {
    return gifts[tokenId].sqtValue;
  }
}