import 'hardhat-gas-reporter';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import '@nomiclabs/hardhat-ethers';
import 'solidity-coverage';

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
        url: 'https://mainnet.infura.io/v3/40569e7ec95f471092ea6435931221ba',
        chainId: 31337,
      },
      mining: {
        auto: true,
      },
    },
  },
  mocha: {
    timeout: 100000,
  },
};
