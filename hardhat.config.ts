import { task } from 'hardhat/config';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import '@nomiclabs/hardhat-ethers';

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
export default {
  solidity: {
    compilers: [
      {
        version: '0.7.6',
<<<<<<< Updated upstream
      },
      {
        version: '0.7.0',
=======
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
            details: {
              yul: false,
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
              yul: false,
            },
          },
        },
>>>>>>> Stashed changes
      },
    ],
  },
};
