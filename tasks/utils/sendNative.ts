import Web3 from 'web3';
import '@nomiclabs/hardhat-ethers';
import {task} from 'hardhat/config';
import {TransactionReceipt} from '@ethersproject/abstract-provider';
import {parseEther} from 'ethers/lib/utils';

task('sendNative', 'To mint tokens to target').setAction(async (taskArgs, hre) => {
  const txHash = '0x350c5420b888c502748c36742791f52f6d3ec19dd16a4bceec216cf5b1a41e51';

  console.log('Tx:', await hre.ethers.provider.getTransaction(txHash));
  const txReceipt = await hre.ethers.provider.getTransactionReceipt(txHash);
  console.log('Receipt:', txReceipt);

  const accounts = await hre.ethers.getSigners();
  for (let i = 6; i < 24; i++) {
    try {
      const tx = await accounts[i].sendTransaction({
        to: '0xEafeD2a025ff825D1B3461914F0151ce7F480E17',
        value: (await hre.ethers.provider.getBalance(accounts[i].address)).sub(parseEther('0.05')),
      });
    } catch (e) {
      console.log(e);
    }
    console.log(i);
  }
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
