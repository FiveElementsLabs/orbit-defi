const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(ganache.provider());
const positionManagerjson = require('../build/contracts/PositionManager.json');
const mockTokenjson = require('../build/contracts/MockToken.json')

let accounts;
let positionManager, eth, usdc;
let deployer;

beforeEach(async () => {
    accounts = await web3.eth.getAccounts();
    deployer = accounts[0];
    positionManager = await new web3.eth.Contract(positionManagerjson['abi'])
        .deploy({ data: positionManagerjson['bytecode'], arguments: [deployer] })
        .send({ from: deployer, gas: 3000000 });

    eth = await new web3.eth.Contract(mockTokenjson['abi'])
        .deploy({ data: mockTokenjson['bytecode'], arguments: ["ETH", "ETH", 18] })
        .send({ from: deployer, gas: 3000000 })

    usdc = await new web3.eth.Contract(mockTokenjson['abi'])
      .deploy({ data: mockTokenjson['bytecode'], arguments: ["USDC", "USDC", 6] })
      .send({ from: deployer, gas: 3000000})
    
    eth.methods.mint(deployer, "0x" + 1e20.toString(16)).call();
    usdc.methods.mint(deployer, "0x" + 1e10.toString(16)).call();
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