import {User} from '../../models';
import {UserRepository} from '../../repositories';
import {PolkadotJs} from '../../utils/polkadotJs-utils';

export function givenUser(user?: Partial<User>) {
  const {getKeyring, getHexPublicKey} = new PolkadotJs();
  const name = 'Abdul Hakim';
  const keyring = getKeyring().addFromUri('//' + name);
  const id = getHexPublicKey(keyring);

  const data = Object.assign(
    {
      id: id,
      name: 'Abdul Hakim',
    },
    user,
  );
  return new User(data);
}

export async function givenUserInstance(userRepository: UserRepository, user?: Partial<User>) {
  return userRepository.create(givenUser(user));
}

export async function givenMutlipleUserInstances(userRepository: UserRepository) {
  return Promise.all([
    givenUserInstance(userRepository),
    givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
      name: 'irman',
    }),
  ]);
}
