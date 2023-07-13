import '@nomiclabs/hardhat-ethers';
import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

task('mintERC721', 'To mint tokens to target').setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
  const accounts = await hre.ethers.getSigners();

  console.log('Account:', accounts[0].address);
  console.log('Account balance:', await accounts[0].getBalance());

  const erc721 = await hre.ethers.getContract('ERC721ReqCreator');
  console.log('ERC721 address:', erc721.address);

  const feeNumerator = 1000;
  const creator = '0x56Dc3F6E88a3DE1E8Abb76c44a7c614AB7961dE1';
  const result = await erc721
    .connect(accounts[0])
    .safeMint(
      '0x6aea0b8F18b355676D56EE878d0aFA74f759f221',
      'https://bafybeiegxykdjoeyoyupunde3dbyhyj2fnygvea26bwecuabc2ssmzugsi.ipfs.w3s.link/metadataHtml.json',
      feeNumerator,
      creator
    );

  const receipt = await result.wait();

  console.log('Transaction hash', receipt.transactionHash);
  return receipt;
});
