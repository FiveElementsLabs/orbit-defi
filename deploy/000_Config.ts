export const START_TIME = Date.now();

export const Config = {
  sleep: 25000,
  gasPrice: 1500000000000,
  gasLimit: 2000000,
  positionManagerFactory: '0xb4f9f129d59bd634fa98d2759ee8c92e9f840802',
  aaveAddressHolder: '0x15959aa9f553a1dAB4dE01351Fb49379eBef77EF',
  uniswapAddressHolder: '0x3980A9AcedE960aA697a9695eBf5026f4b66574f',
  registry: '0x9d3a0625308fd5a4c52cf735fc9d6cca44f0505b',
  timelock: '0x7e349e0d4b7b59c4e913142b7a6034c014a99f89',
};

const func = () => {
  console.log('Initialize sleep timeout: ', Config.sleep);
};

export default func;
