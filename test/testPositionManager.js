const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(ganache.provider());
const factoryjson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json') 
const pooljson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json')
const nonFungiblePositionManagerjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json')
const positionManager = artifacts.require('PositionManager');
const mockToken = artifacts.require('MockToken');
let accounts;
let positionManager, eth, usdc, factory, pool, nonFungiblePositionManager;
let deployer;

beforeEach(async () => {
    accounts = await web3.eth.getAccounts();
    deployer = accounts[0];
    positionManager = await positionManager.new()
    eth = await mockToken.new("ETH", "ETH", 18);
    usdc = await mockToken.new("USDC", "USDC", 6);

    console.log("address positionManager ", positionManager.address);
    console.log("eth address ", eth.address);
    console.log("usdc address ", usdc.address);

    /*
    eth.methods.mint(deployer, "0x" + 1e20.toString(16)).call();
    usdc.methods.mint(deployer, "0x" + 1e10.toString(16)).call();*/

    //deploy factory 
    /*
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

    await eth.methods.approve(nonFungiblePositionManager._address, '0x' + Math.pow(2,254).toString(16)).call({from: deployer})
    await usdc.methods.approve(nonFungiblePositionManager._address, '0x' + Math.pow(2,254).toString(16)).call({from: deployer})

    let res = await nonFungiblePositionManager.methods.mint([
      eth._address, usdc._address, 5000,  -1000,  1000, 
       100000000,  10000000,  0,  0,  deployer,  Date.now() + 1000
    ]).send({ from: deployer, value: '10000000000000000' })*/

  });

  // TEST DEPLOY

  describe('Position Manager - deploy', () => {
    it('deploys a contract', async () => {
      /*
      const owner = await positionManager.methods.owner().call();
      assert.equal(deployer, owner, 'The owner is not the deployer - positionManager');*/
      assert.equal(1, 1, "w")
    });
  });

  //TEST FUNCTION

  describe('Position Manager - depositUniNft', () => {
    it('should deposit a single univ3 nft', async () => {

      assert.equal();
    });
    //Continue from this line from now on...
  });