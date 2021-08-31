import {
  createStubInstance,
  expect,
  sinon,
  StubbedInstanceWithSinonAccessor,
  toJSON,
} from '@loopback/testlab';
import {ActivityController} from '../../controllers';
import {ActivityLogType} from '../../enums';
import {Activity} from '../../models';
import {ActivityRepository} from '../../repositories';
import {givenActivity} from '../helpers';

describe('ActivityController', () => {
  let activityRepository: StubbedInstanceWithSinonAccessor<ActivityRepository>;
  let controller: ActivityController;
  let aActivityWithId: Activity;
  let aListOfActivities: Activity[];

  beforeEach(resetRepositories);

  describe('findActivities', () => {
    it('returns multiple activities if they exist', async () => {
      const find = activityRepository.stubs.find;
      find.resolves(aListOfActivities);
      expect(await controller.find()).to.eql(aListOfActivities);
      sinon.assert.called(find);
    });

    it('returns empty list if no activities exist', async () => {
      const find = activityRepository.stubs.find;
      const expected: Activity[] = [];
      find.resolves(expected);
      expect(await controller.find()).to.eql(expected);
      sinon.assert.called(find);
    });

    it('uses the provided filter', async () => {
      const find = activityRepository.stubs.find;
      const filter = toJSON({where: {id: '1'}});

      find.resolves(aListOfActivities);
      await controller.find(filter);
      sinon.assert.calledWith(find, filter);
    });
  });

  function resetRepositories() {
    activityRepository = createStubInstance(ActivityRepository);
    aActivityWithId = givenActivity({
      id: '1',
    });
    aListOfActivities = [
      aActivityWithId,
      givenActivity({
        id: '2',
        type: ActivityLogType.PROFILE,
        message: 'You updated your profile',
        userId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ks',
      }),
    ] as Activity[];

    controller = new ActivityController(activityRepository);
  }
});
