# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
SubQuery Network Contracts - A comprehensive smart contract suite powering the decentralized SubQuery Network indexing infrastructure. Built with Solidity 0.8.15, Hardhat, and TypeScript.

## Essential Commands

### Development Workflow
```bash
yarn install              # Install dependencies
yarn build                # Build contracts + TypeScript SDK
yarn test                 # Run full test suite
yarn test:coverage        # Run tests with coverage analysis
yarn lint                 # Lint all code (Solidity + TypeScript)
yarn format               # Format all code (Prettier)
```

### Building Components
```bash
yarn build:contract       # Compile Solidity contracts only
yarn build:ts            # Build TypeScript SDK only
yarn build:abi           # Generate ABI files
```

### Testing & Quality
```bash
yarn test:single <file>   # Run specific test file
yarn coverage            # Generate test coverage report
yarn test:fuzz           # Run Echidna fuzz testing
```

### Deployment & Verification
```bash
yarn deploy --testnet     # Deploy to testnet (Polygon Mumbai + Sepolia)
yarn deploy --kepler      # Deploy to Kepler network (staging)
yarn deploy --mainnet     # Deploy to mainnet (Ethereum + Base)
yarn upgrade --testnet    # Upgrade contracts with proxy pattern
yarn verify --testnet     # Verify contracts on block explorers
```

### Documentation
```bash
yarn docs:generate        # Generate contract documentation
yarn docs:build          # Build VuePress documentation site
yarn docs:dev            # Serve docs locally
```

## Architecture Overview

### Multi-Chain Design
- **Layer 1 (Root)**: Ethereum mainnet/Sepolia - token contracts, governance
- **Layer 2 (Child)**: Polygon/Base - main protocol contracts
- **Bridge Integration**: L1↔L2 token transfers via standard bridges

### Contract Organization
```
/contracts/
├── [Root contracts] - 35+ core contracts (Settings, Staking, IndexerRegistry, etc.)
├── /interfaces/ - 24 interface definitions
├── /l2/ - Layer 2 specific implementations
├── /root/ - Layer 1 (root chain) contracts
├── /utils/ - Utility and helper contracts
└── /archive/ - Legacy contract versions
```

### Key Contracts
- **Settings.sol** - Central configuration registry for all protocol parameters
- **Staking.sol** - Core delegation and staking mechanism
- **IndexerRegistry.sol** - Indexer registration and management
- **ProjectRegistry.sol** - Project registration system
- **RewardsDistributor.sol** - Automated reward distribution logic
- **ConsumerHost.sol** - Consumer interaction and payment layer
- **PlanManager.sol** - Service plan management

### Upgrade Pattern
All main contracts use **OpenZeppelin's upgradeable proxy pattern**. When modifying contracts:
1. Ensure storage layout compatibility
2. Test upgrade scripts thoroughly
3. Use upgrade helpers in `/scripts/upgrade.ts`

### SDK Structure
- **TypeScript SDK**: `/src/` - Auto-generated TypeChain bindings + wrapper SDK
- **Rust SDK**: `/rust/` - ethers-rs based SDK for Rust applications
- **Contract Types**: Auto-generated in `/src/typechain/`

### Testing Framework
- **32 comprehensive test files** using Hardhat + Waffle + Chai
- **Helper utilities**: `/test/setup.ts`, `/test/helper.ts` for common test patterns
- **Mock contracts**: `/contracts/mocks/` for isolated testing
- **E2E tests**: Full workflow validation across contract interactions

### Development Setup
- **Node Environment**: CommonJS with ES2020 target
- **Package Manager**: Yarn 3.6.4 (use `yarn` not `npm`)
- **TypeScript**: Strict mode enabled with comprehensive type checking
- **Pre-commit hooks**: Husky + lint-staged for code quality

### Network Configuration
Networks are configured in `hardhat.config.ts`:
- **testnet**: Polygon Mumbai + Sepolia
- **kepler**: Polygon Mainnet (staging environment)
- **mainnet**: Ethereum + Base
- **local**: Hardhat network for development

### Deployment Tracking
- **Published contracts**: `/publish/*.json` files track deployed addresses
- **Network configs**: `/scripts/config/` contains network-specific settings
- **Deployment verification**: Automated Etherscan/Polygonscan verification

### Code Quality Standards
- **Solidity**: Uses Solhint with custom rules (`.solhint.json`)
- **TypeScript**: ESLint with TypeScript rules
- **Formatting**: Prettier for both Solidity and TypeScript
- **Coverage**: Aim for high test coverage, check with `yarn test:coverage`

### Security Considerations
- **Access Control**: Most contracts use Ownable pattern with multi-sig governance
- **Proxy Safety**: Be careful with storage layout when upgrading contracts
- **Audit Integration**: Security audits stored in `/audits/` directory
- **Fuzz Testing**: Echidna configuration for property-based testing

### Common Development Patterns
- **Contract Initialization**: Use `__contractName_init()` pattern for upgradeable contracts
- **Event Emission**: All state changes should emit appropriate events
- **Error Handling**: Use custom errors (introduced in Solidity 0.8.4) for gas efficiency
- **Interface Compliance**: Always implement corresponding interfaces from `/contracts/interfaces/`