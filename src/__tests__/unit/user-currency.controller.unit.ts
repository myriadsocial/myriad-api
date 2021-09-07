import {
  createStubInstance,
  expect,
  sinon,
  StubbedInstanceWithSinonAccessor,
} from '@loopback/testlab';
import {UserCurrencyController} from '../../controllers';
import {UserCurrency} from '../../models';
import {UserCurrencyRepository, UserRepository} from '../../repositories';
import {givenUserCurrency} from '../helpers';

describe('UserCurrencyController', () => {
  let userCurrencyRepository: StubbedInstanceWithSinonAccessor<UserCurrencyRepository>;
  let userRepository: StubbedInstanceWithSinonAccessor<UserRepository>;
  let controller: UserCurrencyController;
  let aUserCurrency: UserCurrency;
  let aUserCurrencyWithId: UserCurrency;

  beforeEach(resetRepositories);

  describe('createUserCurrency', () => {
    it('creates a UserCurrency', async () => {
      const create = userCurrencyRepository.stubs.create;
      create.resolves(aUserCurrencyWithId);
      const result = await controller.create(aUserCurrency);
      expect(result).to.eql(aUserCurrencyWithId);
      sinon.assert.calledWith(create, aUserCurrency);
    });
  });

  describe('deleteUserCurrency', () => {
    it('successfully deletes existing items', async () => {
      const del = userCurrencyRepository.stubs.deleteAll;
      del.resolves({count: 1});
      expect(
        await controller.delete({
          userId: aUserCurrency.userId,
          currencyId: aUserCurrency.currencyId,
        } as UserCurrency),
      ).to.eql({count: 1});
      sinon.assert.called(del);
    });
  });

  function resetRepositories() {
    userCurrencyRepository = createStubInstance(UserCurrencyRepository);
    userRepository = createStubInstance(UserRepository);
    aUserCurrency = givenUserCurrency();
    aUserCurrencyWithId = givenUserCurrency({
      id: '1',
    });

    controller = new UserCurrencyController(
      userCurrencyRepository,
      userRepository,
    );
  }
});
