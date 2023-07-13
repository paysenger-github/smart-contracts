import Web3 from 'web3';
import '@nomiclabs/hardhat-ethers';
// import {ethers} from 'hardhat';
import {task} from 'hardhat/config';
import {TransactionReceipt} from '@ethersproject/abstract-provider';

task('decodeEventEventMakeOffer', 'To mint tokens to target').setAction(async (taskArgs, hre) => {
  const txHash = '0xe3b357500e2451c3a861a0dbc91412c75cd7b0ed35c2a25f023a91439f7220bd';

  console.log('Tx:', await hre.ethers.provider.getTransaction(txHash));
  const txReceipt = await hre.ethers.provider.getTransactionReceipt(txHash);
  console.log('Receipt:', txReceipt);

  for (let i = 0; i < txReceipt.logs.length; i++) {
    console.log('logs:', txReceipt.logs[i]);
  }
});
