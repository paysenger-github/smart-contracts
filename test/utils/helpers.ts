import {ethers, network} from 'hardhat';
import {BigNumber} from 'ethers';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/dist/src/signers';

const zeroAddr = ethers.constants.AddressZero;

// AccessControl roles in bytes32 string
const roles = {
  defaultAdmin: ethers.constants.HashZero, // DEFAULT_ADMIN_ROLE
  admin: ethers.utils.solidityKeccak256(['string'], ['ADMIN_ROLE']),
  minter: ethers.utils.solidityKeccak256(['string'], ['MINTER_ROLE']),
  burner: ethers.utils.solidityKeccak256(['string'], ['BURNER_ROLE']),
  validator: ethers.utils.solidityKeccak256(['string'], ['VALIDATOR_ROLE']),
};

const interfaceIds = {
  erc721: '0x80ac58cd',
};
export const evmTakeSnap = async (): Promise<any> => {
  return await network.provider.request({
    method: 'evm_snapshot',
    params: [],
  });
};

export const evmRestoreSnap = async (id: string) => {
  await network.provider.request({
    method: 'evm_revert',
    params: [id],
  });
};

/**
 * Create a test account
 * @param {string} address
 * @param {ethers.BigNumber} balance
 * @return {ethers.JsonRpcSigner}
 */
export async function impersonateAccount(address: string, balance = ethers.BigNumber.from('0x1000000000000000000000')) {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });

  await network.provider.send('hardhat_setBalance', [address, balance.toHexString()]);

  return await ethers.getSigner(address);
}

/**
 * Set the ETH balance of a given address
 * @param {string} address
 * @param {ethers.BigNumber} balance
 */
export async function setBalance(address: string, balance = ethers.BigNumber.from('0x1000000000000000000000')) {
  balance = ethers.BigNumber.from(balance);
  await network.provider.send('hardhat_setBalance', [address, balance.toHexString()]);
}

export function calculatePercent(percent: BigNumber, sum: BigNumber) {
  SignerWithAddress;
  return ethers.BigNumber.from(sum.mul(percent).div(10000));
}

export {zeroAddr, roles, interfaceIds};

export async function getCurrentTime() {
  return (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
}

export async function getVRS(_validator: SignerWithAddress, _types: any, _values: any) {
  const hash = await ethers.utils.solidityKeccak256(_types, _values);
  const sign = await _validator.signMessage(await ethers.utils.arrayify(hash));
  const {v, r, s} = await ethers.utils.splitSignature(sign);

  return {v, r, s};
}
