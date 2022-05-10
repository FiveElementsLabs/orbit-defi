export const Config = {
  sleep: 30000,
  gasPrice: 2000000000000,
  gasLimit: 1000000,
};

const func = () => {
  console.log('Initialize sleep timeout: ', Config.sleep);
};

export default func;
