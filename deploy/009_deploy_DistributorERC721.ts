import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {admin, distributionCreator} = await getNamedAccounts();

  const feePercent = 5000;
  console.log('distributionCreator', distributionCreator);

  const contract = await deploy('DistributorERC721', {
    from: distributionCreator,
    args: [admin, feePercent],
    log: true,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });

  try {
    if (hre.network.name != 'localhost' && hre.network.name != 'hardhat') {
      await hre.run('verify:verify', {
        address: contract.address,
        constructorArguments: [admin, feePercent],
      });
    }
  } catch (e) {
    console.log(e);
  }
};
export default func;
func.tags = ['DistributorERC721V1'];
