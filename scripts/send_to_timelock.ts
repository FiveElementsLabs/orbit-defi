import { ethers } from 'hardhat';
import { Config } from '../deploy/000_Config';

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_POLYGON);
  const signer = new ethers.Wallet(process.env.POLYGON_PRIVATE_KEY || '', provider);
  const AbiCoder = ethers.utils.defaultAbiCoder;

  const Timelock = await ethers.getContractAt('Timelock', '0x984f2B53e0305FEd33CC3b2eA8baeeAB112Ac217', signer);

  /* 
    /// @param target the target contract address
    /// @param value the value to be sent
    /// @param signature the signature of the transaction to be enqueued
    /// @param data the data of the transaction to be enqueued
    /// @param eta the minimum timestamp at which the transaction can be executed
    /// @return the hash of the transaction in bytes
    */

  // Specific call
  const RegistryAddress = '0x4005F86cBa82659D5d62f354124d84C4969C4F47';
  const DepositRecipesAddress = '0x661395770aD7654D124621f72b8189bF30065350';

  // General call parameters
  const target = RegistryAddress;
  const msgValue = 0;
  const signature = 'addNewContract(address)';
  const data = AbiCoder.encode(['address'], [DepositRecipesAddress]);
  const eta = Math.floor(Date.now() / 1000) + 21750;
  console.log(`ETA: ${new Date(eta * 1000)}`);
  console.log('ETA TIMESTAMP: KEEP THIS TO EXECUTE CALL: ', eta);

  await Timelock.queueTransaction(target, msgValue, signature, data, eta, {
    gasPrice: Config.gasPrice,
    gasLimit: Config.gasLimit,
  });
  console.log('Transaction queued');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
