# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2022-04-20
### Changed
- switch to use hardhat (#155)

### Fixed
- Indexer should not call delegate() (#164)
- fix reregister problem and add tests for it. (#159)

### Added
- more events for reward distributor (#167)
- call lint in PR pipeline (#169)
- check delegation amount > 0 (#168)
- Test clear all expired service agreements (#165)

## [0.4.1] - 2022-04-20
### Added
- testnet season 1 contracts

[Unreleased]: https://github.com/subquery/contracts/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/subquery/contracts/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/subquery/contracts/releases/tag/v0.4.1
