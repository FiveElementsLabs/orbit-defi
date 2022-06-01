import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';
import hre from 'hardhat';

describe('Test MathHelper', () => {
  //GLOBAL VARIABLE - USE THIS
  let signer0: any = ethers.getSigners().then(async (signers) => {
    return signers[0];
  });

  let owner: any;

  //Mock contract MathHelper
  let TestMathHelper: Contract;

  before(async function () {
    owner = await signer0;
    await hre.network.provider.send('hardhat_reset');

    //deploy the contract
    const TestMathHelperFactory = await ethers.getContractFactory('MockMathHelper');
    TestMathHelper = await TestMathHelperFactory.deploy();
    await TestMathHelper.deployed();
  });

  beforeEach(async function () {});

  describe('MathHelper.sol', function () {
    it('should cast uint24 to int24', async function () {
      const result = await TestMathHelper.connect(owner).fromUint24ToInt24(5069);
      expect(result).to.equal(5069);
    });

    it('should cast int24 to uint24', async function () {
      const result = await TestMathHelper.connect(owner).fromInt24ToUint24(-5069);
      expect(result).to.equal(5069);
    });

    it('should cast uint256 to uint24', async function () {
      const result = await TestMathHelper.connect(owner).fromUint256ToUint24(15069);
      expect(result).to.equal(15069);
    });

    it('should revert with overflow if trying to cast uint24 to int24', async function () {
      await expect(TestMathHelper.connect(owner).fromUint24ToInt24(Math.pow(2, 24) + 1)).to.be.reverted;
    });
  });
});
