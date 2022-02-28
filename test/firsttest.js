const PositionManager = artifacts.require('PositionManager')
const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(ganache.provider());
const json = require('../build/contracts/PositionManager.json');

let accounts;
let position;
let manager;
const interface = json['abi'];
const bytecode = json['bytecode'];

beforeEach(async () => {
    accounts = await web3.eth.getAccounts();
    manager = accounts[0];
    position = await new web3.eth.Contract(interface)
        .deploy({ data: bytecode, arguments: [manager] })
        .send({ from: manager, gas: 3000000 });
  });

  describe('Position Manager', () => {
    it('deploys a contract', async () => {
      const positionManagerManager = await position.methods.owner().call();
      assert.equal(manager, positionManagerManager, 'The manager is the one who launches the smart contract.');
    });
    //Continue from this line from now on...
  });