const ethers = require("ethers");
const { Pool, Position, NonfungiblePositionManager } = require("@uniswap/v3-sdk");
const { Token, Percent } = require("@uniswap/sdk-core");
const ganache = require('ganache-cli');
const assert = require('assert');
const Web3 = require('web3');

const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'));
const provider = new ethers.providers.JsonRpcProvider('http://localhost:7545');
console.log(provider.connection)
console.log(web3.currentProvider)

const factoryjson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const pooljson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json');
const nonFungiblePositionManagerjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');

let positionManager = artifacts.require('PositionManager');
let mockToken = artifacts.require('MockToken');
let accounts;
let positionManagerInstance, eth, usdc, factory, pool, nonFungiblePositionManager;
let deployer;


beforeEach(async () => {
    console.log(provider.connection)
    console.log(web3.currentProvider)
    
    accounts = await web3.eth.getAccounts();
    deployer = accounts[0];
    positionManagerInstance = await positionManager.new(deployer);
    eth = await mockToken.new("ETH", "ETH", 18);
    usdc = await mockToken.new("USDC", "USDC", 6);
    
    console.log("address positionManager ", positionManager.address);
    console.log("eth address ", eth.address);
    console.log("usdc address ", usdc.address);

    await eth.mint(deployer, 1e15);
    await usdc.mint(deployer, 1e10);

    //deploy factory 
    factory = await new web3.eth.Contract(factoryjson['abi'])
      .deploy({ data: factoryjson['bytecode'] })
      .send({ from: deployer, gas: 6700000 })

    const tx = await factory.methods.createPool(eth.address, usdc.address, 10000).call()
    console.log(tx)
    pool = await new web3.eth.Contract(pooljson['abi'], tx)

    const poolContract = new ethers.Contract(
      tx,
      pooljson['abi'],
      provider
    );

    console.log(await poolContract.token0())

    /*
    const tick = -200000
    const price = Math.pow(1.0001, tick)

    await pool.methods.initialize('0x' + (Math.sqrt(price) * Math.pow(2,96)).toString(16)).call()
    await pool.methods.increaseObservationCardinalityNext(100).call()*/
    /*
    console.log(pool._address);
    const poolContract = new ethers.Contract(
      tx,
      pooljson['abi'],
      provider
    );

    console.log(await poolContract.token0())

    //deploy pool

    /*
    nonFungiblePositionManager = await new web3.eth.Contract(nonFungiblePositionManagerjson['abi'])
      .deploy({ data: nonFungiblePositionManagerjson['bytecode'], arguments: [ factory._address, eth._address, eth._address] })
      .send({ from:  deployer, gas: 6700000 })
    await eth.approve(nonFungiblePositionManager.address, 1e100)
    await usdc.approve(nonFungiblePositionManager.address, 1e100)*/
    /*
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