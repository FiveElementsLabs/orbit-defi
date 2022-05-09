import { expect } from 'chai';
import '@nomiclabs/hardhat-ethers';
import { Contract, ContractFactory } from 'ethers';
import { ethers } from 'hardhat';
import {
  NonFungiblePositionManagerDescriptorBytecode,
  tokensFixture,
  poolFixture,
  routerFixture,
  RegistryFixture,
  getSelectors,
} from '../shared/fixtures';
import { MockToken, INonfungiblePositionManager, ISwapRouter, UniswapAddressHolder, Registry } from '../../typechain';

import UniswapV3Factoryjson from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json';
import PositionManagerContract from '../../artifacts/contracts/PositionManager.sol/PositionManager.json';
import NonFungiblePositionManagerjson from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json';
import NonFungiblePositionManagerDescriptorjson from '@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json';
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
  let diamondCutFacet: any;
  let registry: any;
  let mintAction: any;
  let AaveAddressHolder: Contract;

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    signers = await ethers.getSigners();
    const user = signers[0];
    owner = signers[0];
    token0 = await tokensFixture('ETH', 18).then((tokenFix) => tokenFix.tokenFixture);
    token1 = await tokensFixture('USDC', 6).then((tokenFix) => tokenFix.tokenFixture);

    //deploy factory, used for pools
    const uniswapFactoryFactory = new ContractFactory(
      UniswapV3Factoryjson['abi'],
      UniswapV3Factoryjson['bytecode'],
      user
    );
    const Factory = (await uniswapFactoryFactory.deploy().then((contract) => contract.deployed())) as Contract;
    poolI = await poolFixture(token0, token1, 3000, Factory).then((poolFix) => poolFix.pool);

    await token0.mint(user.address, ethers.utils.parseEther('1000000000000'));
    await token1.mint(user.address, ethers.utils.parseEther('1000000000000'));

    //deploy NonFungiblePositionManagerDescriptor and NonFungiblePositionManager
    const NonFungiblePositionManagerDescriptorFactory = new ContractFactory(
      NonFungiblePositionManagerDescriptorjson['abi'],
      NonFungiblePositionManagerDescriptorBytecode,
      user
    );
    const NonFungiblePositionManagerDescriptor = await NonFungiblePositionManagerDescriptorFactory.deploy(
      token0.address,
      ethers.utils.formatBytes32String('www.google.com')
    ).then((contract) => contract.deployed());

    const NonFungiblePositionManagerFactory = new ContractFactory(
      NonFungiblePositionManagerjson['abi'],
      NonFungiblePositionManagerjson['bytecode'],
      user
    );
    NonFungiblePositionManager = (await NonFungiblePositionManagerFactory.deploy(
      Factory.address,
      token0.address,
      NonFungiblePositionManagerDescriptor.address
    ).then((contract) => contract.deployed())) as INonfungiblePositionManager;

    //deploy router
    Router = await routerFixture().then((RFixture: any) => RFixture.ruoterDeployFixture);

    //deploy uniswapAddressHolder
    const uniswapAddressHolderFactory = await ethers.getContractFactory('UniswapAddressHolder');
    uniswapAddressHolder = (await uniswapAddressHolderFactory.deploy(
      NonFungiblePositionManager.address,
      Factory.address,
      Router.address
    )) as UniswapAddressHolder;
    await uniswapAddressHolder.deployed();

    //deploy aaveAddressHolder
    const aaveAddressHolderFactory = await ethers.getContractFactory('AaveAddressHolder');
    AaveAddressHolder = await aaveAddressHolderFactory.deploy(NonFungiblePositionManager.address); //random address because it is not used
    await AaveAddressHolder.deployed();

    // deploy DiamondCutFacet ----------------------------------------------------------------------
    const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet');
    diamondCutFacet = await DiamondCutFacet.deploy();
    await diamondCutFacet.deployed();
    await token0
      .connect(signers[0])
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('1000000000000'));

    await token1.approve(NonFungiblePositionManager.address, ethers.utils.parseEther('1000000000000'), {
      from: signers[0].address,
    });

    const Mint = await ethers.getContractFactory('Mint');
    mintAction = await Mint.deploy();
    await mintAction.deployed();
  });

  describe('PositionManagerFactory - create', function () {
    it('Should create a new position manager instance', async function () {
      const PositionManagerFactory = await ethers.getContractFactory('PositionManagerFactory');

      // deploy Registry
      registry = (await RegistryFixture(owner.address)).registryFixture;
      await registry.deployed();

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
        PositionManagerFactoryInstance.address
      );

      [owner] = await ethers.getSigners();

      await PositionManagerFactoryInstance.connect(owner).pushActionData(
        mintAction.address,
        await getSelectors(mintAction)
      );
      await registry.connect(owner).setPositionManagerFactory(PositionManagerFactoryInstance.address);

      await PositionManagerFactoryInstance.create();

      const deployedContract = await PositionManagerFactoryInstance.positionManagers(0);
      const PositionManagerInstance = await ethers.getContractAt(PositionManagerContract.abi, deployedContract);

      expect(PositionManagerInstance).to.exist;
    });
  });
});
