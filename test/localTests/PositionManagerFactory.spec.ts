import { expect } from 'chai';
import '@nomiclabs/hardhat-ethers';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';
import {
  tokensFixture,
  routerFixture,
  RegistryFixture,
  getSelectors,
  deployUniswapContracts,
  deployContract,
} from '../shared/fixtures';
import { MockToken, INonfungiblePositionManager, ISwapRouter, UniswapAddressHolder } from '../../typechain';
import PositionManagerContract from '../../artifacts/contracts/PositionManager.sol/PositionManager.json';
import hre from 'hardhat';

describe('PositionManagerFactory.sol', function () {
  let PositionManagerInstance: Contract;
  let PositionManagerFactoryInstance: Contract;
  let owner: any;
  let signers: any;
  let NonFungiblePositionManager: INonfungiblePositionManager;
  let token0: MockToken, token1: MockToken;
  let uniswapAddressHolder: UniswapAddressHolder;
  let Router: ISwapRouter;
  let poolI: any;
  let Factory: any;
  let diamondCutFacet: any;
  let registry: any;
  let mintAction: any;
  let swapAction: any;
  let AaveAddressHolder: Contract;

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    signers = await ethers.getSigners();
    const user = signers[0];
    owner = signers[0];
    token0 = await tokensFixture('ETH', 18).then((tokenFix) => tokenFix.tokenFixture);
    token1 = await tokensFixture('USDC', 6).then((tokenFix) => tokenFix.tokenFixture);

    //deploy factory, used for pools
    [Factory, NonFungiblePositionManager] = await deployUniswapContracts(token0);

    await token0.mint(user.address, ethers.utils.parseEther('1000000000000'));
    await token1.mint(user.address, ethers.utils.parseEther('1000000000000'));

    //deploy router
    Router = await routerFixture().then((RFixture: any) => RFixture.ruoterDeployFixture);

    diamondCutFacet = await deployContract('DiamondCutFacet');

    await token0
      .connect(signers[0])
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('1000000000000'));

    await token1.approve(NonFungiblePositionManager.address, ethers.utils.parseEther('1000000000000'), {
      from: signers[0].address,
    });

    const Mint = await ethers.getContractFactory('Mint');
    mintAction = await Mint.deploy();
    await mintAction.deployed();

    const Swap = await ethers.getContractFactory('Swap');
    swapAction = await Swap.deploy();
    await swapAction.deployed();
  });

  describe('PositionManagerFactory - create', function () {
    it('Should create a new position manager instance', async function () {
      const PositionManagerFactory = await ethers.getContractFactory('PositionManagerFactory');

      // deploy Registry
      registry = (await RegistryFixture(owner.address)).registryFixture;
      await registry.deployed();
      AaveAddressHolder = await deployContract('AaveAddressHolder', [
        NonFungiblePositionManager.address,
        registry.address,
      ]);
      //deploy uniswapAddressHolder
      uniswapAddressHolder = (await deployContract('UniswapAddressHolder', [
        NonFungiblePositionManager.address,
        Factory.address,
        Router.address,
        registry.address,
      ])) as UniswapAddressHolder;

      PositionManagerFactoryInstance = await PositionManagerFactory.deploy(
        owner.address,
        registry.address,
        diamondCutFacet.address,
        uniswapAddressHolder.address,
        AaveAddressHolder.address
      );
      await PositionManagerFactoryInstance.deployed();

      await registry.addNewContract(
        hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('PositionManagerFactory')),
        PositionManagerFactoryInstance.address,
        hre.ethers.utils.formatBytes32String('1'),
        true
      );

      [owner] = await ethers.getSigners();

      await PositionManagerFactoryInstance.connect(owner).updateActionData({
        facetAddress: mintAction.address,
        action: 0,
        functionSelectors: await getSelectors(mintAction),
      });
      await PositionManagerFactoryInstance.connect(owner).updateActionData({
        facetAddress: swapAction.address,
        action: 0,
        functionSelectors: await getSelectors(swapAction),
      });
      await registry.connect(owner).setPositionManagerFactory(PositionManagerFactoryInstance.address);

      await PositionManagerFactoryInstance.create();

      const deployedContract = await PositionManagerFactoryInstance.positionManagers(0);
      PositionManagerInstance = await ethers.getContractAt(PositionManagerContract.abi, deployedContract);

      expect(PositionManagerInstance).to.exist;
    });

    it('should remove the mint action from an existing position manager', async () => {
      const positionManagerAddress = await PositionManagerFactoryInstance.positionManagers(0);

      await PositionManagerFactoryInstance.updateDiamond(positionManagerAddress, [
        {
          facetAddress: '0x0000000000000000000000000000000000000000',
          action: 2,
          functionSelectors: await getSelectors(mintAction),
        },
      ]);
    });

    it('should change the swap action address from an existing position manager', async () => {
      const positionManagerAddress = await PositionManagerFactoryInstance.positionManagers(0);

      const Swap2 = await ethers.getContractFactory('Swap');
      const swapAction2 = await Swap2.deploy();
      await swapAction2.deployed();

      await PositionManagerFactoryInstance.updateDiamond(positionManagerAddress, [
        {
          facetAddress: swapAction2.address,
          action: 1,
          functionSelectors: await getSelectors(swapAction2),
        },
      ]);
    });

    it('should remove an action from actionData array', async () => {
      const oldActionData = await PositionManagerFactoryInstance.actions(0);
      await PositionManagerFactoryInstance.updateActionData({
        facetAddress: mintAction.address,
        action: 2,
        functionSelectors: await getSelectors(mintAction),
      });
      const newActionData = await PositionManagerFactoryInstance.actions(0);

      expect(oldActionData.facetAddress).to.be.not.equal(newActionData.facetAddress);
    });
  });
});
