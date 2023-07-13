import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {admin, distributionCreator, validator} = await getNamedAccounts();
  const feePercent = 5000;
  const token = (await deployments.get('EgoToken')).address;
  const contract = await deploy('ConduitERC721', {
    from: distributionCreator,
    args: [feePercent, token],
    log: true,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });

  try {
    if (hre.network.name != 'localhost' && hre.network.name != 'hardhat') {
      await hre.run('verify:verify', {
        address: contract.address,
        constructorArguments: [feePercent, token],
      });
    }
  } catch (e) {
    console.log(e);
  }
};
export default func;
func.tags = ['ConduitERC721'];
