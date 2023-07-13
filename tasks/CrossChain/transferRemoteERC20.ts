import '@nomiclabs/hardhat-ethers';
import {parseEther} from 'ethers/lib/utils';
import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

task('transferRemoteERC20', 'To mint tokens to target').setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
  const accounts = await hre.ethers.getSigners();

  console.log('Account:', accounts[1].address);
  console.log('accounts.address:', accounts[1].address);

  console.log('Native Balance account:', (await accounts[1].getBalance()).toString());
  const erc20Token = await hre.ethers.getContract('EgoToken');
  console.log('Token address', erc20Token.address);
  console.log('Token balance', (await erc20Token.balanceOf(accounts[1].address)).toString());

  const bridgeMaster = accounts[1].address;

  const amount = parseEther('600000');
  const destinationChainNumber = 97;
  const sourceChainId = 80001;
  const _salt = Math.floor(Math.random() * 100000);
  const destinationChain = 'binance';
  console.log('bridge', bridgeMaster);
  const types = ['uint256', 'address', 'address', 'uint256', 'address', 'uint256', 'uint256'];
  const values = [
    sourceChainId,
    accounts[1].address,
    bridgeMaster,
    amount,
    erc20Token.address,
    _salt,
    destinationChainNumber,
  ];

  console.log('Message signer address', bridgeMaster);

  const hash = hre.ethers.utils.solidityKeccak256(types, values);
  const signedData = await accounts[1].signMessage(hre.ethers.utils.arrayify(hash));
  const {v, r, s} = hre.ethers.utils.splitSignature(signedData);

  const transferRemoteTx = await erc20Token
    .connect(accounts[1])
    .transferRemote(destinationChain, bridgeMaster, amount, _salt, v, r, s, {value: parseEther('0.2')});
  await transferRemoteTx.wait();

  console.log('hash', transferRemoteTx.hash);

  console.log('inputs', destinationChain, bridgeMaster, amount.toString(), _salt, v, r, s);
});
