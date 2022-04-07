<h1 align="center">Orbit: Vault Optimizer</h1>

<div align="center">

![Solidity](https://img.shields.io/badge/Solidity-0.7.6-e6e6e6?style=for-the-badge&logo=solidity&logoColor=black) ![NodeJS](https://img.shields.io/badge/Node.js-16.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

[![Discord](https://img.shields.io/badge/Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/WVpsDphE) [![Twitter](https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com/OrbitFi) [![Website](https://img.shields.io/badge/Website-E34F26?style=for-the-badge&logo=Google-chrome&logoColor=white)](https://orbitdefi.finance/) [![Docs](https://img.shields.io/badge/Docs-7B36ED?style=for-the-badge&logo=gitbook&logoColor=white)](https://fiveelementslabs.gitbook.io/orbit/)

</div>

> Orbit is a DeFi smart vault Optimizer that automates and rebalances your LP strategies effortlessly, starting with Uniswap V3.

We chose Uniswap v3 as the first protocol to automate. Our choice was driven by:

- The fact that concentrated liquidity is a new paradigm which is increasingly sucking out volumes from older design AMMs
- The fact that more protocols are providing concentrated liquidity, such as new Sushi Trident
- The market size and volumes of concentrated liquidity protocols. We are speaking about 1 trillion annualized volume as we write these docs
- The number of options and strategies allowed by these protocols and possible integrations to offer
- The fact that there are several vaults out there that provide strategies on top of Uniswap v3. This strategies are very simple (indeed, replicable with Orbit), costly (fees take about 1-2% of TVL) and overall not effective with respect to just holding the asset. We take a strategy agnostic approach, our aim is increasing return for any liquidity provider in Uni v3, independently from the strategy of choice

## Installation

```bash
git clone https://github.com/FiveElementsLabs/orbit-defi
cd orbit-defi
yarn install
```

## Usage

```bash
npx hardhat compile

# you can compile specific files by selecting the path
npx hardhat compile ./contracts/PositionManager.sol

npx hardhat node --network localhost
```

This project uses `hardhat`, so you can find the compiler configurations in `hardhat.config.ts`.

## Test

```bash
npx hardhat test

# you can test specific files by selecting the path
npx hardhat test ./test/actions/Mint.spec.tx
```

## Security

If you find bugs, please [contact us on Discord](https://discord.gg/WVpsDphE).

## Documentation

You can read more about Orbit DeFi on our [documentation website](https://fiveelementslabs.gitbook.io/orbit/).

## Licensing

The primary license for Orbit Vault is the Open Source License [MIT](https://spdx.org/licenses/MIT.html).
