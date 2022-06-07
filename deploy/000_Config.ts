export const START_TIME = Date.now();

export const Config = {
  sleep: 25000,
  gasPrice: 1500000000000,
  gasLimit: 1000000,
};

const func = () => {
  console.log('Initialize sleep timeout: ', Config.sleep);
};

export default func;
