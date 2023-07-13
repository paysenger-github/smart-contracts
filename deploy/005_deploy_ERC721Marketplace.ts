import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {admin, distributionCreator} = await getNamedAccounts();

  const feePercent = 500;
  const contract = await deploy('ERC721Market', {
    from: distributionCreator,
    args: [feePercent],
    log: true,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });

  try {
    if (hre.network.name != 'localhost' && hre.network.name != 'hardhat') {
      await hre.run('verify:verify', {
        address: contract.address,
        constructorArguments: [feePercent],
      });
    }
  } catch (e) {
    console.log(e);
  }
};

export default func;
func.tags = ['ERC721Market'];
