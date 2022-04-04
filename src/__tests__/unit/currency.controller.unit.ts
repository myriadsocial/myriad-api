import {
  createStubInstance,
  expect,
  sinon,
  StubbedInstanceWithSinonAccessor,
  toJSON,
} from '@loopback/testlab';
import {CurrencyController} from '../../controllers';
import {Currency} from '../../models';
import {CurrencyRepository} from '../../repositories';
import {givenCurrency} from '../helpers';

describe('CurrencyControllers', () => {
  let currencyRepository: StubbedInstanceWithSinonAccessor<CurrencyRepository>;
  let controller: CurrencyController;
  let aCurrencyWithId: Currency;
  let aListOfCurrencies: Currency[];

  beforeEach(resetRepositories);

  describe('findCurrencyById', () => {
    it('returns a currency if it exists', async () => {
      const findById = currencyRepository.stubs.findById;
      findById.resolves(aCurrencyWithId);
      expect(await controller.findById(aCurrencyWithId.id as string)).to.eql(
        aCurrencyWithId,
      );
      sinon.assert.calledWith(findById, aCurrencyWithId.id);
    });
  });

  describe('findCurrencies', () => {
    it('returns multiple currencies if they exist', async () => {
      const find = currencyRepository.stubs.find;
      find.resolves(aListOfCurrencies);
      expect(await controller.find()).to.eql(aListOfCurrencies);
      sinon.assert.called(find);
    });

    it('returns empty list if no currencies exist', async () => {
      const find = currencyRepository.stubs.find;
      const expected: Currency[] = [];
      find.resolves(expected);
      expect(await controller.find()).to.eql(expected);
      sinon.assert.called(find);
    });

    it('uses the provided filter', async () => {
      const find = currencyRepository.stubs.find;
      const filter = toJSON({where: {id: 'ACA'}});

      find.resolves(aListOfCurrencies);
      await controller.find(filter);
      sinon.assert.calledWith(find, filter);
    });
  });

  function resetRepositories() {
    currencyRepository = createStubInstance(CurrencyRepository);
    aCurrencyWithId = givenCurrency({
      id: '1',
    });
    aListOfCurrencies = [
      aCurrencyWithId,
      givenCurrency({
        id: '1',
        name: 'AUSD',
        symbol: 'AUSD',
        decimal: 13,
        image: 'https://apps.acala.network/static/media/AUSD.439bc3f2.png',
        native: true,
        networkId: 'acala',
      }),
    ] as Currency[];

    controller = new CurrencyController(currencyRepository);
  }
});
