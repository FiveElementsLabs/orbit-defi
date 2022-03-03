const PositionManager = artifacts.require("PositionManager");
const MockToken = artifacts.require("../test/MockToken");

module.exports = function (deployer) {
  deployer.deploy(PositionManager, "0x1a8b90606c1c6fe2e94cb32681913990e9305a2e");
  deployer.deploy(MockToken, "USDC", "USDC", 6);
}
