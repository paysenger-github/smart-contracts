import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {sleep} from '../test/utils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {admin, EgoTokenDeployer, bridgeMaster, distributionCreator} = await getNamedAccounts();
  const egoToken = (await deployments.get('EgoToken')).address;
  const levelsToken = (await deployments.get('PaysengerLevels')).address;

  const contract = await deploy('ERC1155Market', {
    from: distributionCreator,
    args: [admin, egoToken, levelsToken],
    log: true,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });

  try {
    if (hre.network.name != 'localhost' && hre.network.name != 'hardhat') {
      await sleep(20000);
      await hre.run('verify:verify', {
        address: contract.address,
        constructorArguments: [admin, egoToken, levelsToken],
      });
    }
  } catch (e) {
    console.log(e);
  }
};
export default func;
func.tags = ['ERC1155Exchange'];
