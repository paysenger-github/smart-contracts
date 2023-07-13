import {Contract} from 'ethers';
import {ethers} from 'hardhat';

export async function setupUsers<T extends {[contractName: string]: Contract}>(
  addresses: string[],
  contracts: T
): Promise<({address: string} & T)[]> {
  const users: ({address: string} & T)[] = [];
  for (const address of addresses) {
    users.push(await setupUser(address, contracts));
  }
  return users;
}
export function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

export async function setupUser<T extends {[contractName: string]: Contract}>(
  address: string,
  contracts: T
): Promise<{address: string} & T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user: any = {address};
  for (const key of Object.keys(contracts)) {
    user[key] = contracts[key].connect(await ethers.getSigner(address));
  }
  return user as {address: string} & T;
}

const zeroAddr = ethers.constants.AddressZero;

// AccessControl roles in bytes32 string
const roles = {
  admin: ethers.constants.HashZero, // DEFAULT_ADMIN_ROLE
  minter: ethers.utils.solidityKeccak256(['string'], ['MINTER_ROLE']),
  burner: ethers.utils.solidityKeccak256(['string'], ['BURNER_ROLE']),
};

const interfaceIds = {
  erc721: '0x80ac58cd',
};

const sleep = async (ms: any) => {
  ms = ms === undefined ? 1000 : ms;
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const getNativeBalances = async (checkedAddresses: string[]) => {
  const nativeBalances = [];
  for (let i = 0; i < checkedAddresses.length; i++) {
    nativeBalances[i] = await ethers.provider.getBalance(checkedAddresses[i]);
  }
  return nativeBalances;
};

const getAddressFromEnv = async (name: string) => {
  return eval('process.env.' + name) !== undefined ? eval('process.env.' + name) : '';
};

const getCurrentTimestamp = async () => {
  return (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
};

const compareBalances = async (initialBalances: any, finalBalances: any) => {
  const result = [];
  if (initialBalances.length != finalBalances.length) {
    console.log('Length of arrays mismatch');
    return false;
  }
  for (let i = 0; i < initialBalances.length; i++) {
    result.push(initialBalances[i] - finalBalances[i]);
  }
  console.log(result);
  return result;
};
export {
  zeroAddr,
  roles,
  interfaceIds,
  getCurrentTimestamp,
  sleep,
  getNativeBalances,
  compareBalances,
  getAddressFromEnv,
};
