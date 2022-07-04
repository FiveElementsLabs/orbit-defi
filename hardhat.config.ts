import 'hardhat-gas-reporter';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import '@nomiclabs/hardhat-ethers';
import 'hardhat-deploy';
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
        url: process.env.ALCHEMY_MAINNET || '',
        blockNumber: 15000000,
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
      url: process.env.ALCHEMY_MUMBAI || '',
      accounts: [process.env.TEST_PRIVATE_KEY || ''],
      verify: {
        etherscan: {
          apiKey: process.env.ETHERSCAN_API_KEY || '',
          apiUrl: 'https://mumbai.polygonscan.com/',
        },
      },
    },
    polygon: {
      url: process.env.ALCHEMY_POLYGON || '',
      accounts: [process.env.POLYGON_PRIVATE_KEY || ''],
      verify: {
        etherscan: {
          apiKey: process.env.ETHERSCAN_API_KEY || '',
          apiUrl: 'https://api.polygonscan.com/',
        },
      },
    },
  },
  mocha: {
    timeout: 200000,
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    multiSig: {
      default: 0,
    },
  },
};
