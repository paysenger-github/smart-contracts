import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {sleep} from '../test/utils';
import {parseEther} from 'ethers/lib/utils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {admin, distributionCreator} = await getNamedAccounts();
  console.log('Staking deployer address', admin);
  const stakeToken = (await deployments.get('EgoToken')).address;

  const rewardToken = 'reward token address';
  const rewardTokenContract = await hre.ethers.getContractAt('EgoToken', rewardToken);
  const rewardPerEpoch = parseEther('1000');
  const epochDuration = 3600 * 24 * 1;
  const rewardDistributionPeriod = 60;
  const lockPeriod = epochDuration;

  const contract = await deploy('Staking', {
    from: distributionCreator,
    args: [stakeToken, stakeToken, rewardPerEpoch, epochDuration, rewardDistributionPeriod, lockPeriod],
    log: true,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });

  try {
    if (hre.network.name != 'localhost' && hre.network.name != 'hardhat') {
      await sleep(20000);
      await hre.run('verify:verify', {
        address: contract.address,
        constructorArguments: [
          stakeToken,
          stakeToken,
          rewardPerEpoch,
          epochDuration,
          rewardDistributionPeriod,
          lockPeriod,
        ],
      });
    }
  } catch (e) {
    console.log(e);
  }

  // await rewardTokenContract.transfer('0x5cbd419A8Aa5d1573002Add6BEC5eD82D7175258', '999999999999999999000');
};

export default func;
func.tags = ['Staking'];
