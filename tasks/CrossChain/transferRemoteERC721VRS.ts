import '@nomiclabs/hardhat-ethers';
import {randomInt} from 'crypto';
import {parseEther} from 'ethers/lib/utils';
import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

task('transferRemoteERC721VRS', 'To mint tokens to target').setAction(
  async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const accounts = await hre.ethers.getSigners();

    console.log('Account:', accounts[0].address);
    console.log('Native Balance:', (await accounts[0].getBalance()).toString());

    const erc721Token = await hre.ethers.getContract('ERC721ReqCreator');
    console.log('Token balance', (await erc721Token.balanceOf(accounts[0].address)).toString());
    const mintTx = await erc721Token.safeMint(accounts[0].address, 'simpleUri', 100, accounts[0].address);
    await mintTx.wait();

    const tokenId = await erc721Token._tokenIdCounter();
    const salt = randomInt(1, 1000);
    const types = ['uint256', 'address', 'uint256', 'address', 'uint256'];
    const values = [80001, accounts[0].address, tokenId.sub(1), erc721Token.address, salt];
    console.log('Message signer address', accounts[0].address);

    const hash = hre.ethers.utils.solidityKeccak256(types, values);
    const signedData = await accounts[0].signMessage(hre.ethers.utils.arrayify(hash));
    const {v, r, s} = hre.ethers.utils.splitSignature(signedData);

    const destinationChain = 'aurora';

    const transferTx = await erc721Token
      .connect(accounts[0])
      ['transferRemote(string,address,uint256,uint256,uint8,bytes32,bytes32)'](
        destinationChain,
        accounts[0].address,
        tokenId.sub(1),
        salt,
        v,
        r,
        s,
        {
          value: parseEther('0.1'),
        }
      );
    await transferTx.wait();

    console.log('hash', transferTx.hash);
  }
);
