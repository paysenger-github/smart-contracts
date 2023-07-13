import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {sleep} from '../test/utils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {admin, distributionCreator, EgoTokenDeployer, bridgeMaster} = await getNamedAccounts();

  const contract = await deploy('PaysengerLevels', {
    from: distributionCreator,
    args: [],
    log: true,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });

  try {
    if (hre.network.name != 'localhost' && hre.network.name != 'hardhat') {
      await sleep(20000);
      await hre.run('verify:verify', {
        address: contract.address,
        constructorArguments: [],
      });
    }
  } catch (e) {
    console.log(e);
  }
};
export default func;
func.tags = ['levelsERC1155'];
