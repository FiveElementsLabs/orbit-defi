<div align="center">
<img src="https://user-images.githubusercontent.com/48695862/164207845-eabce4bd-e5f7-4065-b4d7-0b8c32289704.png" />
</div>

<h1 align="center">Smart Vault Optimizer</h1>

<div align="center">

![Solidity](https://img.shields.io/badge/Solidity-0.7.6-e6e6e6?style=for-the-badge&logo=solidity&logoColor=black) ![NodeJS](https://img.shields.io/badge/Node.js-16.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

[![Discord](https://img.shields.io/badge/Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/t3PQeh3896) [![Twitter](https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com/OrbitFi) [![Website](https://img.shields.io/badge/Website-E34F26?style=for-the-badge&logo=Google-chrome&logoColor=white)](https://orbitdefi.finance/) [![Docs](https://img.shields.io/badge/Docs-7B36ED?style=for-the-badge&logo=gitbook&logoColor=white)](https://fiveelementslabs.gitbook.io/orbit/)

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

Create an environment file `.env` with the following content:

```text
INFURA_MAINNET=https://mainnet.infura.io/v3/your_infura_key
ALCHEMY_MUMBAI=https://polygon-mumbai.g.alchemy.com/v2/your_alchemy_key
ALCHEMY_POLYGON=https://polygon-mainnet.g.alchemy.com/v2/your_alchemy_key
TEST_PRIVATE_KEY=425....214
POLYGON_PRIVATE_KEY=425....214
ETHERSCAN_API_KEY=your_etherscan_api_key
```

Then you can compile the contracts:

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

## Basic Flowchart

![contracts_flow](https://user-images.githubusercontent.com/48695862/170303316-23948c2c-24e1-4591-ad2c-3a1d0f1a9d07.png)

## Security

If you find bugs, please [contact us on Discord](https://discord.gg/WVpsDphE). Alternatively, you can open an issue here on GitHub or send an email to [vincenzo@fiveelementslabs.com](mailto:vincenzo@fiveelementslabs.com).

## Documentation

You can read more about Orbit DeFi on our [documentation website](https://fiveelementslabs.gitbook.io/orbit/).

## Licensing

The primary license for Orbit DeFi is the GNU General Public License v2.0 (GPLv2).
You can [read the full LICENSE here](./LICENSE).

If you need to get in touch, please send an email to [vincenzo@fiveelementslabs.com](mailto:vincenzo@fiveelementslabs.com) or [Join our Discord server](https://discord.gg/WVpsDphE).
