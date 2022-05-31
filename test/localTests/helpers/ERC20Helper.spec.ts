import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Contract, ContractFactory } from 'ethers';
import hre from 'hardhat';
import { ethers } from 'hardhat';
import { MockToken } from '../../../typechain';
import { tokensFixture, mintSTDAmount } from '../../shared/fixtures';

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
    tokenEth = (await tokensFixture('ETH', 18)).tokenFixture;

    //deploy the contract
    const TestERC20HelperFactory = await ethers.getContractFactory('MockERC20Helper');
    TestERC20Helper = await TestERC20HelperFactory.deploy();
    await TestERC20Helper.deployed();
  });

  beforeEach(async function () {});

  describe('TestERC20Helper - approveToken', function () {
    it("approves spender to be the spender of owner's tokens", async function () {
      const tokenToApproveAmount = '100000000000000';
      await TestERC20Helper.connect(spender).approveToken(
        tokenEth.address,
        owner.address,
        ethers.utils.parseEther(tokenToApproveAmount)
      );
      const allowance = await tokenEth.connect(spender).allowance(TestERC20Helper.address, owner.address);
      expect(allowance.toString()).to.equal(ethers.utils.parseEther(tokenToApproveAmount));
    });

    it('approves spender to be the spender of owners tokens with -1 amount', async function () {
      const tokenToApproveAmount = '-1';
      let errorMessage;
      try {
        await TestERC20Helper.connect(spender).approveToken(
          tokenEth.address,
          owner.address,
          ethers.utils.parseEther(tokenToApproveAmount)
        );
      } catch (e: any) {
        errorMessage = e.reason;
      }

      expect(errorMessage).to.equal('value out-of-bounds');
    });
  });

  describe('TestERC20Helper - getBalance', function () {
    it("gets balance of owner's token", async function () {
      await mintSTDAmount(tokenEth);
      const balance = await TestERC20Helper.getBalance(tokenEth.address, owner.address);
      expect(balance.toString()).to.equal((await tokenEth.balanceOf(owner.address)).toString());
    });
    it("Should fail to get balance of random's address", async function () {
      let errorMessage;
      try {
        await TestERC20Helper.getBalance(tokenEth.address, '0x0');
      } catch (e: any) {
        errorMessage = e.reason;
      }

      expect(errorMessage).to.equal('invalid address');
    });
  });

  describe('TestERC20Helper - getAllowance', function () {
    it("gets allowance of owner's token", async function () {
      await mintSTDAmount(tokenEth);
      tokenEth.connect(owner).approve(TestERC20Helper.address, ethers.utils.parseEther('100000000000000'));
      const allowance = await TestERC20Helper.getAllowance(tokenEth.address, owner.address, spender.address);
      expect(allowance.toString()).to.equal((await tokenEth.allowance(owner.address, spender.address)).toString());
    });

    it("gets allowance of owner's token with approve amount equal 0", async function () {
      await mintSTDAmount(tokenEth);
      tokenEth.connect(owner).approve(TestERC20Helper.address, ethers.utils.parseEther('0'));
      const allowance = await TestERC20Helper.getAllowance(tokenEth.address, owner.address, spender.address);
      expect(allowance.toString()).to.equal((await tokenEth.allowance(owner.address, spender.address)).toString());
    });
  });

  describe('TestERC20Helper - withdrawTokens', function () {
    it('should give transfer amount exceeds allowance', async function () {
      await tokenEth.connect(owner).transfer(TestERC20Helper.address, '100000000000000');

      await expect(
        TestERC20Helper.connect(owner).withdrawTokens(
          tokenEth.address,
          owner.address,
          ethers.utils.parseEther('100000')
        )
      ).to.be.revertedWith('ERC20: transfer amount exceeds allowance');
    });

    it('withdraws tokens from owner to ', async function () {
      await mintSTDAmount(tokenEth);
      await tokenEth.connect(owner).approve(TestERC20Helper.address, ethers.utils.parseEther('100000000000000'));
      await tokenEth.connect(owner).transfer(TestERC20Helper.address, '100000000000000');

      const ownerBalanceBefore = await tokenEth.balanceOf(owner.address);

      await TestERC20Helper.connect(owner).approve(tokenEth.address, owner.address);

      await TestERC20Helper.connect(owner).withdrawTokens(tokenEth.address, owner.address, '1');
      const ownerBalanceAfter = await tokenEth.balanceOf(owner.address);

      expect(ownerBalanceAfter.toString()).to.be.equal(ownerBalanceBefore.add('1').toString());
    });
  });

  describe('TestERC20Helper - pullTokensIfNeeded', function () {
    it('pulls tokens from owner to ', async function () {
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

    it('should revert to pulls tokens from owner ', async function () {
      await mintSTDAmount(tokenEth);
      const balanceBeforeOwner = await tokenEth.balanceOf(owner.address);
      const balanceBeforeTestERC20Helper = await tokenEth.balanceOf(TestERC20Helper.address);
      tokenEth.connect(owner).approve(TestERC20Helper.address, ethers.utils.parseEther('100000000000'));

      await expect(
        TestERC20Helper.connect(owner).pullTokensIfNeeded(
          tokenEth.address,
          owner.address,
          ethers.utils.parseEther('10000000000000000000000')
        )
      ).to.be.reverted;

      const balanceAfterOwner = await tokenEth.balanceOf(owner.address);
      const balanceAfterTestERC20Helper = await tokenEth.balanceOf(TestERC20Helper.address);
      expect(balanceBeforeOwner).to.be.equal(balanceAfterOwner);
      expect(balanceBeforeTestERC20Helper).to.be.equal(balanceAfterTestERC20Helper);
    });

    it('pulls tokens from owner to ', async function () {
      await mintSTDAmount(tokenEth);
      const balanceBeforeOwner = await tokenEth.balanceOf(owner.address);
      const balanceBeforeTestERC20Helper = await tokenEth.balanceOf(TestERC20Helper.address);
      tokenEth.connect(owner).approve(TestERC20Helper.address, ethers.utils.parseEther('100000000000'));

      await TestERC20Helper.connect(owner).pullTokensIfNeeded(tokenEth.address, owner.address, '1');
      const balanceAfterOwner = await tokenEth.balanceOf(owner.address);
      const balanceAfterTestERC20Helper = await tokenEth.balanceOf(TestERC20Helper.address);
      expect(balanceBeforeOwner).to.be.equal(balanceAfterOwner);
      expect(balanceBeforeTestERC20Helper).to.be.equal(balanceAfterTestERC20Helper);
    });
  });
});
