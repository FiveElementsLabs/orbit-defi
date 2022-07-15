import { HardhatRuntimeEnvironment } from 'hardhat/types';

export const START_TIME = Date.now();

export const Config = {
  sleep: 25000,
  gasPrice: 700 * 1e9,
  gasLimit: 5 * 1e6,
};

const func = (hre: HardhatRuntimeEnvironment) => {
  const { network } = hre;

  if (!network?.live) Config.sleep = 0;

  console.log(`:: Initialized sleep timeout: ${Config.sleep}ms`);
};

export default func;
