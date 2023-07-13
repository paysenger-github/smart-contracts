import '@nomiclabs/hardhat-ethers';
import {ethers} from 'hardhat';
import {task} from 'hardhat/config';

task('checkBlockchain', 'To mint tokens to target').setAction(async (taskArgs, hre) => {
  const txHash = '0x68b538ec03455cd85c5fe36158d5f971e126564016a50416985932887fcd12c4';

  console.log('Tx:', await hre.ethers.provider.getTransaction(txHash));

  const txReceipt = await hre.ethers.provider.getTransactionReceipt(txHash);
  console.log('Receipt:', txReceipt.logs);

  const block = await hre.ethers.provider.getBlock(await hre.ethers.provider.getBlockNumber());
  const deadline = block.timestamp + 3600 * 25 * 7;
  console.log(deadline);
});
