import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getCurrentTimestamp, sleep} from '../test/utils';
import {BigNumber} from 'ethers';
import BalanceTree from '../test/utils/Merkle-vesting/balance-tree';
import {parseEther} from 'ethers/lib/utils';
import fs from 'fs';

//use tags in hardhat deploy for deployment
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {admin, distributionCreator} = await getNamedAccounts();
  console.log('Vesting deployer address', distributionCreator);
  const token = (await deployments.get('EgoToken')).address;
  const currentTime = await getCurrentTimestamp();

  const vestingPercentage = BigNumber.from(20);
  const vestingStartTime = 1688666400;
  const vestingEndTime = 1720288800;
  const filename = 'name.json';

  const data = fs.readFileSync(`./assets/distribution/mainnet/json/${filename}`);
  const jsonData = JSON.parse(data);
  let totalAmountOfVesting = BigNumber.from(0);

  for (let i = 0; i < jsonData.length; i++) {
    console.log(i);
    jsonData[i].amount = parseEther(jsonData[i].amount.toString());
    totalAmountOfVesting = totalAmountOfVesting.add(BigNumber.from(jsonData[i].amount));
  }

  const tree = new BalanceTree(jsonData);

  console.log('root', tree.getHexRoot());

  console.log('total amount of vesting', [
    token,
    tree.getHexRoot(),
    vestingPercentage,
    totalAmountOfVesting,
    vestingStartTime,
    vestingEndTime,
  ]);

  const gasPrice = await hre.ethers.provider.getGasPrice();
  console.log('gasPrice', gasPrice.toString());

  const contract = await deploy('Vesting', {
    from: distributionCreator,
    args: [token, tree.getHexRoot(), vestingPercentage, totalAmountOfVesting, vestingStartTime, vestingEndTime],
    log: true,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
    // gasLimit: 4000000,
    // gasPrice: gasPrice.mul(3),
  });

  try {
    if (hre.network.name != 'localhost' && hre.network.name != 'hardhat') {
      await sleep(20000);
      await hre.run('verify:verify', {
        address: contract.address,
        constructorArguments: [
          token,
          tree.getHexRoot(),
          vestingPercentage,
          totalAmountOfVesting,
          vestingStartTime,
          vestingEndTime,
        ],
      });
    }
  } catch (e) {
    console.log(e);
  }

  const proofs = [];
  for (let i = 0; i < jsonData.length; i++) {
    proofs.push({
      id: 0,
      wallet_address: jsonData[i].account,
      contract_address: contract.address,
      contract_name: '',
      token_price: 0,
      token_amount: jsonData[i].amount.toString(),
      purchase_summ: 0,
      proofs: tree.getProof(0, jsonData[i].account, jsonData[i].amount).toString(),
      createdAt: 0,
      updatedAt: 0,
    });
    totalAmountOfVesting = totalAmountOfVesting.add(BigNumber.from(jsonData[i].amount));
  }

  const stringified = JSON.stringify(proofs);
  fs.appendFileSync(`./assets/distribution/mainnet/proofs/${filename}`, stringified);
  console.log('file written');
};

export default func;
func.tags = ['Vesting1'];
