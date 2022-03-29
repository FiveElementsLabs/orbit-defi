import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Contract, ContractFactory } from 'ethers';
const hre = require('hardhat');
import { ethers } from 'hardhat';
import { Test } from 'mocha';

import { MockToken } from '../../typechain';
import { tokensFixture, mintSTDAmount } from '../shared/fixtures';

describe('TestERC20Helper', () => {
  //GLOBAL VARIABLE - USE THIS
  let signer0: any = ethers.getSigners().then(async (signers) => {
    return signers[0];
  });
  let signer1: any = ethers.getSigners().then(async (signers) => {
    return signers[1];
  });

  let owner: any;
  let spender: any;

  //all the token used globally
  let tokenEth: MockToken;

  //Mock contract ERC20Helper
  let TestERC20Helper: Contract;

  before(async function () {
    owner = await signer0;
    spender = await signer1;
    await hre.network.provider.send('hardhat_reset');

    //deploy the token
    tokenEth = await tokensFixture('ETH', 18).then((tokenFix) => tokenFix.tokenFixture);

    //deploy the contract
    const TestERC20HelperFactory = await ethers.getContractFactory('TestERC20Helper');
    TestERC20Helper = await TestERC20HelperFactory.deploy();
    await TestERC20Helper.deployed();
  });

  beforeEach(async function () {});

  describe('TestERC20Helper - approveToken', function () {
    it("Approve spender to be the spender of owner's tokens", async function () {
      const tokenToApproveAmount = '100000000000000';
      await TestERC20Helper.connect(spender).approveToken(
        tokenEth.address,
        owner.address,
        ethers.utils.parseEther(tokenToApproveAmount)
      );
      const allowance = await tokenEth.connect(spender).allowance(TestERC20Helper.address, owner.address);
      expect(allowance.toString()).to.equal(ethers.utils.parseEther(tokenToApproveAmount));
    });
  });

  describe('TestERC20Helper - getBalance', function () {
    it("Get balance of owner's token", async function () {
      await mintSTDAmount(tokenEth);
      const balance = await TestERC20Helper.getBalance(tokenEth.address, owner.address);
      expect(balance.toString()).to.equal((await tokenEth.balanceOf(owner.address)).toString());
    });
  });

  describe('TestERC20Helper - getAllowance', function () {
    it("Get allowance of owner's token", async function () {
      await mintSTDAmount(tokenEth);
      tokenEth.connect(owner).approve(TestERC20Helper.address, ethers.utils.parseEther('100000000000000'));
      const allowance = await TestERC20Helper.getAllowance(tokenEth.address, owner.address, spender.address);
      console.log(allowance);
      expect(allowance.toString()).to.equal((await tokenEth.allowance(owner.address, spender.address)).toString());
    });

    it("Get allowance of owner's token with approve equal 0", async function () {
      await mintSTDAmount(tokenEth);
      tokenEth.connect(owner).approve(TestERC20Helper.address, ethers.utils.parseEther('0'));
      const allowance = await TestERC20Helper.getAllowance(tokenEth.address, owner.address, spender.address);
      console.log(allowance);
      expect(allowance.toString()).to.equal((await tokenEth.allowance(owner.address, spender.address)).toString());
    });
  });

  describe('TestERC20Helper - withdrawTokens', function () {
    it('Withdraw tokens exceed allowance', async function () {
      await tokenEth.connect(owner).transfer(TestERC20Helper.address, '100000000000000');

      await expect(
        TestERC20Helper.connect(owner).withdrawTokens(
          tokenEth.address,
          owner.address,
          ethers.utils.parseEther('100000')
        )
      ).to.be.revertedWith('ERC20: transfer amount exceeds allowance');
    });
    it('Withdraw tokens from owner to ', async function () {
      await mintSTDAmount(tokenEth);
      await tokenEth.connect(owner).approve(TestERC20Helper.address, ethers.utils.parseEther('100000000000000'));
      await tokenEth.connect(owner).transfer(TestERC20Helper.address, '100000000000000');

      const ownerBalanceBefore = await tokenEth.balanceOf(owner.address);

      await TestERC20Helper.connect(owner).approve(tokenEth.address, owner.address);

      await TestERC20Helper.connect(owner).withdrawTokens(tokenEth.address, owner.address, '1');
      const ownerBalanceAfter = await tokenEth.balanceOf(owner.address);

      expect(ownerBalanceAfter.toString()).to.be.equal(ownerBalanceBefore.add('1').toString());
    });

    //TODO: test withdraw with result 'ERC20: transfer amount exceeds allowance'
  });

  describe('TestERC20Helper - pullTokensIfNeeded', function () {
    it('Pull tokens from owner to ', async function () {
      await mintSTDAmount(tokenEth);
      const balanceBeforeOwner = await tokenEth.balanceOf(owner.address);
      const balanceBeforeTestERC20Helper = await tokenEth.balanceOf(TestERC20Helper.address);
      tokenEth.connect(owner).approve(TestERC20Helper.address, ethers.utils.parseEther('100000000000'));

      await TestERC20Helper.connect(owner).pullTokensIfNeeded(
        tokenEth.address,
        owner.address,
        ethers.utils.parseEther('1000000000')
      );
      const balanceAfterOwner = await tokenEth.balanceOf(owner.address);
      const balanceAfterTestERC20Helper = await tokenEth.balanceOf(TestERC20Helper.address);
      expect(balanceBeforeOwner.div(balanceAfterOwner).toNumber()).to.be.equal(1);
      expect(balanceBeforeTestERC20Helper).to.be.lt(balanceAfterTestERC20Helper);
    });
  });
});

//4999999999999999900000000000000  -  4999000000000000000000000000000
//4999000000000000000000000000000  -  4998999999999999900000000000000
