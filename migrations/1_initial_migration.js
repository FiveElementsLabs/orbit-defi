const PositionManager = artifacts.require("PositionManager");

module.exports = function (deployer, accounts) {
  deployer.deploy(PositionManager, '0xbe556cbbd2dfe48a47c3d9ba3f46920fd92dab48');
};
