import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {sleep} from '../test/utils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {admin, distributionCreator} = await getNamedAccounts();
  console.log('Deployer', distributionCreator);

  const gateway = process.env[`${hre.network.name}` + '_gateway_address'];
  const gasReceiver = process.env[`${hre.network.name}` + '_gas_service_address'];
  const supportedChains = ['Polygon', 'binance', 'aurora'];
  const chainids = [80001, 97, 1313161555];
  const rolesReceiver = 'address who receives the roles';

  const name = 'Paysenger Request - Response';
  const symbol = 'PSG-Request';

  const contract = await deploy('ERC721ReqCreator', {
    from: distributionCreator,
    args: [name, symbol, gateway, gasReceiver, supportedChains, chainids, rolesReceiver],
    log: true,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });

  try {
    if (hre.network.name != 'localhost' && hre.network.name != 'hardhat') {
      await sleep(20000);
      await hre.run('verify:verify', {
        address: contract.address,
        constructorArguments: [name, symbol, gateway, gasReceiver, supportedChains, chainids, rolesReceiver],
      });
    }
  } catch (e) {
    console.log(e);
  }
};
export default func;
func.tags = ['ERC721RequestorCreator'];
