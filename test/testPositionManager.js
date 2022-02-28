const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(ganache.provider());
const factoryjson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json') 
const pooljson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json')
const nonFungiblePositionManagerjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json')
const positionManagerjson = require('../build/contracts/PositionManager.json');
const mockTokenjson = require('../build/contracts/MockToken.json')
let accounts;
let positionManager, eth, usdc, factory, pool, NonfungiblePositionManager;
let deployer;

beforeEach(async () => {
    accounts = await web3.eth.getAccounts();
    deployer = accounts[0];
    positionManager = await new web3.eth.Contract(positionManagerjson['abi'])
        .deploy({ data: positionManagerjson['bytecode'], arguments: [deployer] })
        .send({ from: deployer, gas: 3000000 });

    //deploy token
    eth = await new web3.eth.Contract(mockTokenjson['abi'])
      .deploy({ data: mockTokenjson['bytecode'], arguments: ["ETH", "ETH", 18] })
      .send({ from: deployer, gas: 3000000 })

    usdc = await new web3.eth.Contract(mockTokenjson['abi'])
      .deploy({ data: mockTokenjson['bytecode'], arguments: ["USDC", "USDC", 6] })
      .send({ from: deployer, gas: 3000000})
    
    eth.methods.mint(deployer, "0x" + 1e20.toString(16)).call();
    usdc.methods.mint(deployer, "0x" + 1e10.toString(16)).call();

    //deploy factory 
    factory = await new web3.eth.Contract(factoryjson['abi'])
      .deploy({ data: factoryjson['bytecode'] })
      .send({ from: deployer, gas: 6700000 })


    let tx = await factory.methods.createPool(eth._address, usdc._address, 10000).call()

    pool = await new web3.eth.Contract(pooljson['abi'], tx)

    await pool.methods.initialize('0x' + (Math.sqrt(1e18 / 2000e6) * Math.pow(2,96)).toString(16)).call()
    await pool.methods.increaseObservationCardinalityNext(100).call()

    nonFungiblePositionManager = await new web3.eth.Contract(nonFungiblePositionManagerjson['abi'])
      .deploy({ data: nonFungiblePositionManagerjson['bytecode'], arguments: [ factory._address, eth._address, eth._address] })
      .send({ from:  deployer, gas: 6700000 })

  });

  // TEST DEPLOY

  describe('Position Manager - deploy', () => {
    it('deploys a contract', async () => {
      const owner = await positionManager.methods.owner().call();
      assert.equal(deployer, owner, 'The owner is not the deployer - positionManager');
    });
  });

  //TEST FUNCTION

  describe('Position Manager - depositUniNft', () => {
    it('should deposit a single univ3 nft', async () => {

      assert.equal();
    });
    //Continue from this line from now on...
  });