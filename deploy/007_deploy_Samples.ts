import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {admin} = await getNamedAccounts();
  console.log('i am here');

  const erc721Sample = await deploy('ERC721Sample', {
    from: admin,
    args: [],
    log: true,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });

  try {
    if (hre.network.name != 'localhost' && hre.network.name != 'hardhat') {
      await hre.run('verify:verify', {
        address: erc721Sample.address,
        constructorArguments: [],
      });
    }
  } catch (e) {
    console.log(e);
  }

  const erc20Sample = await deploy('ERC20Sample', {
    from: admin,
    args: [],
    log: true,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });
  console.log('ERC20 sample address', erc20Sample.address);

  try {
    if (hre.network.name != 'localhost' && hre.network.name != 'hardhat') {
      await hre.run('verify:verify', {
        address: erc20Sample.address,
        constructorArguments: [],
      });
    }
  } catch (e) {
    console.log(e);
  }
};
export default func;
func.tags = ['ERC20Sample', 'ERC721Sample'];
