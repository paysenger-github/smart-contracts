import Web3 from 'web3';
import '@nomiclabs/hardhat-ethers';
import {ethers} from 'hardhat';
import {task} from 'hardhat/config';
import {TransactionReceipt} from '@ethersproject/abstract-provider';
const web3 = new Web3(Web3.givenProvider || 'ws://remotenode.com:8546');

task('decodeEventTransfer', 'To mint tokens to target').setAction(async (taskArgs, hre) => {
  const txHash = '0x350c5420b888c502748c36742791f52f6d3ec19dd16a4bceec216cf5b1a41e51';

  console.log('Tx:', await hre.ethers.provider.getTransaction(txHash));
  const txReceipt = await hre.ethers.provider.getTransactionReceipt(txHash);
  console.log('Receipt:', txReceipt);

  console.log(getTokenIdFromTransactionReceipt(txReceipt));
});

function getTokenIdFromTransactionReceipt(txReceipt: TransactionReceipt) {
  let decodedReceiptMintERC721;
  for (let i = 0; i < txReceipt.logs.length; i++) {
    if (
      txReceipt.logs[i].topics[0] == '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' &&
      txReceipt.logs[i].topics[1] == '0x0000000000000000000000000000000000000000000000000000000000000000'
    ) {
      console.log(txReceipt.logs[i].topics[3]);

      decodedReceiptMintERC721 = web3.eth.abi.decodeParameter('uint256', txReceipt.logs[i].topics[3]);

      return decodedReceiptMintERC721.tokenId;
    }
    return 0;
  }
}
