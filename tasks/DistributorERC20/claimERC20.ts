import '@nomiclabs/hardhat-ethers';
import {parseEther} from 'ethers/lib/utils';
import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

task('claimERC20', 'To mint tokens to target').setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
  const accounts = await hre.ethers.getSigners();

  console.log('Account:', accounts[6].address);
  console.log('accounts[3].address:', accounts[3].address);

  console.log('Native Balance accounts[6]:', (await accounts[6].getBalance()).toString());
  console.log('Native Balance accounts[3]:', (await accounts[3].getBalance()).toString());

  const erc20Token = await hre.ethers.getContractAt('EgoToken', '0x0d701ca2dA8b5797a17B750b94043fBf89cCbB03');
  console.log('Token balance', (await erc20Token.balanceOf(accounts[6].address)).toString());

  const bridgeMaster = accounts[6].address;

  const types = ['address', 'uint256', 'uint256', 'uint256'];
  const values = ['0x8992535F059d0DFf8F2054c3196B0686a0DB71B9', 10000, 80001, 13];

  console.log('Message signer address', bridgeMaster);
  const privateKey = '';
  const signer = new hre.ethers.Wallet(privateKey, hre.ethers.provider);
  const hash = hre.ethers.utils.solidityKeccak256(types, values);
  const signedData = await signer.signMessage(hre.ethers.utils.arrayify(hash));
  const {v, r, s} = hre.ethers.utils.splitSignature(signedData);
  console.log(v);
  console.log(r);
  console.log(s);
});
