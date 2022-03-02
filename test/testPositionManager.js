const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(ganache.provider());
const factoryjson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json') 
const pooljson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json')
const positionManagerjson = require('../build/contracts/PositionManager.json');
const mockTokenjson = require('../build/contracts/MockToken.json')

const { Pool } = require("@uniswap/v3-sdk");
const { Token } = require("@uniswap/sdk-core");

let accounts;
let positionManager, eth, usdc, factory, pool;
let deployer;

function encodePriceSqrt(reserve1, reserve0) {
  return '0x' + (Math.ceil( Math.sqrt(reserve1.toString() / reserve0.toString()) 
    * Math.pow(2,96) )).toString(16)
  
}


beforeEach(async () => {
    accounts = await web3.eth.getAccounts();
    deployer = accounts[0];
    positionManager = await new web3.eth.Contract(positionManagerjson['abi'])
        .deploy({ data: positionManagerjson['bytecode'], arguments: [deployer] })
        .send({ from: deployer, gas: 3000000 });

    const chainId = await web3.eth.getChainId();
    
    console.log(chainId)

    //deploy token
    eth = await new web3.eth.Contract(mockTokenjson['abi'])
      .deploy({ data: mockTokenjson['bytecode'], arguments: ["ETH", "ETH", 18] })
      .send({ from: deployer, gas: 3000000 })

    usdc = await new web3.eth.Contract(mockTokenjson['abi'])
      .deploy({ data: mockTokenjson['bytecode'], arguments: ["USDC", "USDC", 6] })
      .send({ from: deployer, gas: 3000000})
    
    await eth.methods.mint(deployer, "0x" + 1e20.toString(16)).call();
    await usdc.methods.mint(deployer, "0x" + 1e10.toString(16)).call();

   


 
    //deploy factory 
    factory = await new web3.eth.Contract(factoryjson['abi'])
      .deploy({ data: factoryjson['bytecode'] })
      .send({ from: deployer, gas: 6700000 })



    const tx = await factory.methods.createPool(eth._address, usdc._address, 10000).call()
    console.log(tx)
    console.log('pool created')

    pool = await new web3.eth.Contract(pooljson['abi'], tx)

    //const fees = await pool.methods.fee().call()
    const tick = -200000
    const price = Math.pow(1.0001, tick)
    console.log(price)

    await pool.methods.initialize('0x' + (Math.sqrt(price) * Math.pow(2,96)).toString(16)).call()
    await pool.methods.increaseObservationCardinalityNext(100).call()



    console.log('before fee')
    /* const fees = await pool.methods.liquidity().call()
    console.log('fees')
    console.log(fees) */

    const TokenB = new Token(chainId, usdc._address, 6, "USDC", "USDC");
    const TokenA = new Token(chainId, eth._address, 18, "ETH", "ETH");


    const poolExample = new Pool(
      TokenA,
      TokenB,
      10000, //fees
      Math.sqrt(price) * Math.pow(2,96),
      0,
      tick
    );


    console.log(poolExample)



   /* nonFungiblePositionManager = await new web3.eth.Contract(nonFungiblePositionManagerjson['abi'])
      .deploy({ data: nonFungiblePositionManagerjson['bytecode'], arguments: [ factory._address, eth._address, eth._address] })
      .send({ from:  deployer, gas: 6700000 })

    await eth.methods.approve(nonFungiblePositionManager._address, "115792089237316195423570985008687907853269984665640564039457584007913129639935").send({ from: deployer })
    await usdc.methods.approve(nonFungiblePositionManager._address, "115792089237316195423570985008687907853269984665640564039457584007913129639935").send({ from: deployer })
    
    await eth.methods.allowance(deployer, nonFungiblePositionManager._address).call()

    const mintParams = {
      token0: eth._address,
      token1: usdc._address,
      fee: '5000',
      tickLower: '-2900',
      tickUpper: '2900',
      amount0Desired: '1000000000000000',
      amount1Desired: '100000',
      amount0Min: '0',
      amount1Min: '0',
      recipient: deployer,
      deadline: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
    }
 
    
    console.log('MINT PARAMS')
    console.log(mintParams)
    console.log('-----------')

      const blockNumber = await web3.eth.getBlockNumber();

      const blockStats = await web3.eth.getBlock(blockNumber);
      console.log(blockStats)

      const res = await nonFungiblePositionManager.methods.mint(Object.values(mintParams)).send({ from: deployer, value: '10000000000000000', gas: 6700000 })
      
      console.log(res) */
    
  });

  // TEST DEPLOY

  describe('Position Manager - deploy', () => {
    it('deploys a contract', async () => {
      const owner = await positionManager.methods.owner().call();
      assert.equal(deployer, owner, 'The owner is not the deployer - positionManager');
    });
  });

  // //TEST FUNCTION

 /* describe('Position Manager - depositUniNft', () => {
    it('should deposit a single univ3 nft', async () => {

      console.log('should deposit')
    });
    //Continue from this line from now on...
  });*/


