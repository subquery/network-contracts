# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.17.0] - 2023-10-25
### Added
- add planTemplate active check in acceptPlan, acceptOffer, renewAgreement \* update tests \* rename mmrRoot to poi (#255)
- add channel price storage (#279)

## [0.16.2] - 2023-10-25
### Added
- Update `PlanManager` contract (#241)
- renew agreement skip threshold check (#240)
- Add more events to Vesting Contract (#244)
- add per account trade limit (usd) (#250)

## [0.16.0] - 2023-10-25
### Added
- Stable price support (#222)
- Merge pull request #231 from subquery/feat/improve-contracts

## [0.15.0] - 2023-10-25
### Added
- Enable VSQToken and Settings to be upgradeable (#227)

## [0.14.0] - 2023-10-25
### Added
- Add paid fee to event
- Add ConsumerRegistry contract (#213)
- Add `setSettings` function to contracts

## [0.13.7] - 2023-10-25
### Added
- add consumer controller (#201)
- Update permissions in state channel  (#202)

## [0.13.4] - 2023-10-25
### Added
- Add/swap limit (#199)
- Revert/reset reward table (#209)

### Fixed
- Fix rewards (#206)

## [0.13.2] - 2023-10-25
### Added
- fix number in UnbondRequested and DistributeRewards incorrect (#190)
- Add commission to RewardsDistributer event (#192)
- Contract SDK refactoring (#198)

## [0.13.0] - 2023-10-25
### Added
- Update/kepler config (#176)
- Kepler launch (#177)

## [0.12.2] - 2023-10-25
### Added
- Add new event for disputeFinalised (#133)
- add maintenance mode (#131)
- Cleanup IndexerRegistry contracts (#144)
- Remove unused variable in QueryRegistry (#147)
- add controller to airdrop (#156)
- Support update airdrop round (#165)

### Fixed
- Fix unbonding length (#166)
- Fix the amount in the event (#167)

## [0.11.0] - 2023-10-25
### Added
- Add events for add remove user (#117)
- Fix consumer host approve to state channel (#120)
- add dispute (#118)
- Optimization staking (#127)
- Commission to unbound (#129)
- Cleanup PlanManager contract (#128)
- encode revert message (#130)

### Fixed
- Fix consumer host approve to state channel (#120)
- Fix sqt `increaseAllowance` call (#121)
- Bug fix for withdraw unbound (#122)

## [0.10.3] - 2023-10-25
### Fixed
- fix removePlan (#50)
- fix unstake (#86)
- Fix challenge (#95)

### Added
- Feat/sqt 51 update quota (#52)
- Add mint for sqt (#56)
- Add event quota added (#63)
- Add update indexer status (#69)
- update permissionedExchange contract and tests (#75)
- Batch collect rewards pool (#74)
- Split RewardsDistributer to RewardsStaking (#76)
- Rust sdk (#66)
- Make minimum staking amount as parameter (#87)
- Add ConsumerHost contract (#88)
- Update consumerAuthAllows (#93)
- Support authorized consumer in ConsumerHost (#92)
- change challenge to terminate (#97)
- Support deposit and approve in one tx (#99)
- move verify to IConsumer contract (#101)
- Add callback to state channel open event (#103)
- Add price to channel open and event (#105)
- Support multiple signers to consumer host contract (#114)
- Terminate when spent is 0 (#113)

## [0.10.1] - 2022-08-16
### Added
- improve sdk init speed

## [0.10.0] - 2022-08-16
### Added
- Release version for Kepler

[Unreleased]: https://github.com/subquery/network-contracts/compare/v0.17.0...HEAD
[0.17.0]: https://github.com/subquery/network-contracts/compare/v0.16.2...v0.17.0
[0.16.2]: https://github.com/subquery/network-contracts/compare/v0.16.0...v0.16.2
[0.16.0]: https://github.com/subquery/network-contracts/compare/v0.15.0...v0.16.0
[0.15.0]: https://github.com/subquery/network-contracts/compare/v0.14.0...v0.15.0
[0.14.0]: https://github.com/subquery/network-contracts/compare/v0.13.7...v0.14.0
[0.13.7]: https://github.com/subquery/network-contracts/compare/v0.13.4...v0.13.7
[0.13.4]: https://github.com/subquery/network-contracts/compare/v0.13.2...v0.13.4
[0.13.2]: https://github.com/subquery/network-contracts/compare/v0.13.0...v0.13.2
[0.13.0]: https://github.com/subquery/network-contracts/compare/v0.12.2...v0.13.0
[0.12.2]: https://github.com/subquery/network-contracts/compare/v0.11.0...v0.12.2
[0.11.0]: https://github.com/subquery/network-contracts/compare/v0.10.3...v0.11.0
[0.10.3]: https://github.com/subquery/network-contracts/compare/v0.10.1...v0.10.3
[0.10.1]: https://github.com/subquery/network-contracts/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/subquery/network-contracts/releases/tag/v0.10.0
