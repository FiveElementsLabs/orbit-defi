import 'hardhat-gas-reporter';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import '@nomiclabs/hardhat-ethers';
import 'solidity-coverage';
import 'dotenv/config';

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

export default {
  gasReporter: {
    enabled: false,
    currency: 'EUR',
    gasPrice: 35,
  },
  solidity: {
    compilers: [
      {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
            details: {
              yul: true,
            },
          },
        },
      },
      {
        version: '0.7.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
            details: {
              yul: true,
            },
          },
        },
      },

      {
        version: '0.7.0',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
            details: {
              yul: true,
            },
          },
        },
      },
    ],
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      forking: {
        enabled: true,
        url: process.env.INFURA_MAINNET,
        chainId: 31337,
      },
      mining: {
        auto: true,
      },
    },
    localhost: {
      port: 8545,
      chainId: 31337,
      gas: 30000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
      timeout: 1800000,
    },
    mumbai: {
      url: 'https://polygon-mumbai.g.alchemy.com/v2/mUKm3cdZmLfDUkWQfH4PFWvWoIPI7chM',
      accounts: ['063b6d5c1358b3689dd713f0b9be34c8858ca95a26e4031a803ec30f5936cf18'],
    },
  },
  mocha: {
    timeout: 100000,
  },
};
