import '@nomiclabs/hardhat-ethers';
import {parseEther} from 'ethers/lib/utils';
import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

task('transferRemoteERC721', 'To mint tokens to target').setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
  const accounts = await hre.ethers.getSigners();

  console.log('Account:', accounts[3].address);
  console.log('Native Balance:', (await accounts[3].getBalance()).toString());

  const erc721Token = await hre.ethers.getContract('ERC721ReqCreator');
  console.log('Token balance', (await erc721Token.balanceOf(accounts[3].address)).toString());

  const feeNumerator = 1000;
  const creator = '0x56Dc3F6E88a3DE1E8Abb76c44a7c614AB7961dE1';
  const result = await erc721Token
    .connect(accounts[3])
    .safeMint(
      accounts[3].address,
      'https://gateway.pinata.cloud/ipfs/QmaLxPr4e6b9DVuh4mxGL2wHzG15raaBhvRS65dDeYU8aU',
      feeNumerator,
      creator
    );
  await result.wait();

  const tokenId = await erc721Token._tokenIdCounter();
  const destinationChain = 'Polygon';

  const transferTx = await erc721Token
    .connect(accounts[3])
    .transferRemote(destinationChain, accounts[3].address, tokenId.sub(1), {value: parseEther('0.01')});
  await transferTx.wait();

  console.log('hash', transferTx.hash);
});
