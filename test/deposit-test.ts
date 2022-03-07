import { expect } from "chai";
import "@nomiclabs/hardhat-ethers";
import { NonfungiblePositionManager, PositionManager } from "../typechain";
import { Contract, Wallet } from "ethers";
import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { IUniswapV3Pool } from "../typechain";
import { tokensFixture, poolFixture } from "./shared/fixtures";

// `describe` is a Mocha function that allows you to organize your tests. It's
// not actually needed, but having your tests organized makes debugging them
// easier. All Mocha functions are available in the global scope.

// `describe` receives the name of a section of your test suite, and a callback.
// The callback must define the tests of that section. This callback can't be
// an async function.

describe("Position manager contract", function () {
  // Mocha has four functions that let you hook into the the test runner's
  // lifecyle. These are: `before`, `beforeEach`, `after`, `afterEach`.

  // They're very useful to setup the environment for tests, and to clean it
  // up after they run.

  // A common pattern is to declare some variables, and assign them in the
  // `before` and `beforeEach` callbacks.
  // @ts-ignore
  let PositionManagerInstance;
  let owner: any;
  let user: SignerWithAddress;
  let NonFungiblePositionManager: Contract;

  before(async function () {
    // Initializing pool states
    const { token0, token1 } = await tokensFixture();
    const { pool, NonfungiblePositionManager } = await poolFixture(
      token0,
      token1
    );
    NonFungiblePositionManager = NonfungiblePositionManager;
    const signers = await ethers.getSigners();
    const user = signers[1];
    await token0.mint(user.address, ethers.utils.parseEther("1000000000000"));
    await token1.mint(user.address, ethers.utils.parseEther("1000000000000"));
    let startTick = -240000;
    const price = Math.pow(1.0001, startTick);
    await pool.initialize(
      "0x" + (Math.sqrt(price) * Math.pow(2, 96)).toString(16)
    );
    await pool.increaseObservationCardinalityNext(100);
    const { sqrtPriceX96, tick } = await pool.slot0();
    console.log(tick);
    await token0
      .connect(signers[0])
      .approve(
        NonFungiblePositionManager.address,
        ethers.utils.parseEther("1000000000000")
      );
    await token1
      .connect(signers[0])
      .approve(
        NonFungiblePositionManager.address,
        ethers.utils.parseEther("1000000000000")
      );

    const tx = await NonFungiblePositionManager.mint(
      [
        token0.address,
        token1.address,
        3000,
        -180000,
        240000,
        10,
        10,
        0,
        0,
        signers[0].address,
        Date.now() + 1000,
      ],
      { from: signers[0].address, gasLimit: 670000 }
    );
    console.log(await tx.wait());
  });

  // `beforeEach` will run before each test, re-deploying the contract every
  // time. It receives a callback, which can be async.
  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    [owner] = await ethers.getSigners();
    const PositionManager = await ethers.getContractFactory("PositionManager");
    PositionManagerInstance = await PositionManager.deploy(owner.address);
    await PositionManagerInstance.deployed();
  });

  describe("Deploy correctly", function () {
    it("Should correcly initialize constructor", async function () {
      // @ts-ignore
      expect(await PositionManagerInstance.owner()).to.equal(owner.address);
    });
  });

  describe("NonfungiblePositionToken deployed correctly", function () {
    it("Should correctly initialize constructor", async function () {
      expect(await NonFungiblePositionManager.signer.getAddress()).to.equal(
        owner.address
      );
    });
  });
});
