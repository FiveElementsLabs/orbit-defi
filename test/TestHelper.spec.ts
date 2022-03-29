import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Contract, ContractFactory } from 'ethers';
const hre = require('hardhat');
import { ethers } from 'hardhat';

import { MockToken } from '../typechain';
import { tokensFixture } from './shared/fixtures';

describe('TestERC20Helper', () => {
  //GLOBAL VARIABLE - USE THIS
  let user: any = ethers.getSigners().then(async (signers) => {
    return signers[0];
  });

  //all the token used globally
  let tokenEth: MockToken;

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    //deploy the token
    tokenEth = await tokensFixture('ETH', 18).then((tokenFix) => tokenFix.tokenFixture);

    //deploy the contract
    const TestERC20HelperFactory = ethers.getContractFactory('TestERC20Helper');
    const TestERC20Helper = await (await TestERC20HelperFactory).deploy().then((d) => d.deployed());
  });

  beforeEach(async function () {});

  describe('PositionManager - depositUniNft', function () {
    it('should deposit a single UNI NFT', async function () {
      console.log('ciao');
    });
  });
});
