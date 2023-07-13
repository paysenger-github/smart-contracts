import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {sleep} from '../test/utils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {admin, distributionCreator} = await getNamedAccounts();
  console.log('Deployer address', distributionCreator);

  const name = 'TestToken';
  const symbol = 'Test';
  const validator = distributionCreator;
  const bridgeMaster = distributionCreator;
  const gateway = process.env[`${hre.network.name}` + '_gateway_address'];
  const gasReceiver = process.env[`${hre.network.name}` + '_gas_service_address'];
  console.log('name', name);
  console.log('symbol', symbol);
  console.log('validator', validator);
  console.log('bridgeMaster', bridgeMaster);
  console.log('gateway', gateway);
  console.log('gasReceiver', gasReceiver);

  const contract = await deploy('EgoToken', {
    from: distributionCreator,
    args: [name, symbol, gateway, gasReceiver, validator, bridgeMaster],
    log: true,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });

  try {
    if (hre.network.name != 'localhost' && hre.network.name != 'hardhat') {
      await sleep(20000);
      await hre.run('verify:verify', {
        address: contract.address,
        constructorArguments: [name, symbol, gateway, gasReceiver, validator, bridgeMaster],
      });
    }
  } catch (e) {
    console.log(e);
  }
};

export default func;
func.tags = ['egotoken'];
