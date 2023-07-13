import '@nomiclabs/hardhat-ethers';
import {parseEther} from 'ethers/lib/utils';
import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

task('changeBridgeStatus', 'To mint tokens to target').setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
  const accounts = await hre.ethers.getSigners();

  console.log('Account:', accounts[1].address);

  console.log('Native Balance accounts[1]:', (await accounts[1].getBalance()).toString());
  const erc20Token = await hre.ethers.getContract('EgoToken');
  console.log('Token balance', (await erc20Token.balanceOf(accounts[1].address)).toString());

  const bridgeMaster = accounts[1].address;

  console.log('bridge', bridgeMaster);
  const change_brige_status = await erc20Token.connect(accounts[1]).changeBridgeStatus();
  const receipt = await change_brige_status.wait();
  console.log('receipt', receipt);
});
