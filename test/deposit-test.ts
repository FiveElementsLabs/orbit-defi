import { expect } from "chai";
import "@nomiclabs/hardhat-ethers";
const UniswapV3Factoryjson = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json");
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { tokensFixture } from "./shared/fixtures";

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
  let owner: SignerWithAddress;

  // `beforeEach` will run before each test, re-deploying the contract every
  // time. It receives a callback, which can be async.
  beforeEach(async function () {
    //Get signer
    [owner] = await ethers.getSigners();

    // Get token
    const { token0, token1 } = await tokensFixture();
    console.log(token0);
    console.log(token1);

    // Get the factory
    const UniswapV3FactoryFactory = new ethers.ContractFactory(
      UniswapV3Factoryjson.abi,
      UniswapV3Factoryjson.bytecode,
      owner
    );
    const UniswapV3Factory = await UniswapV3FactoryFactory.deploy();

    // Get the ContractFactory and Signers here.
    const PositionManager = await ethers.getContractFactory("PositionManager");
    PositionManagerInstance = await PositionManager.deploy(
      owner.address,
      UniswapV3Factory.address,
      token0.address,
      token0.address
    );
    await PositionManagerInstance.deployed();
  });

  describe("Deploy correctly", function () {
    it("Should correcly initialize constructor", async function () {
      // @ts-ignore
      expect(await PositionManagerInstance.owner()).to.equal(owner.address);
    });
  });
});
