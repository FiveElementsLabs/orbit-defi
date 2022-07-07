export const START_TIME = Date.now();

export const Config = {
  sleep: 25000,
  gasPrice: 100 * 1e9,
  gasLimit: 5 * 1e6,
};

const func = () => {
  console.log(`:: Initialized sleep timeout: ${Config.sleep}ms`);
};

export default func;
