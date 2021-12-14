import {
  createStubInstance,
  expect,
  sinon,
  StubbedInstanceWithSinonAccessor,
  toJSON,
} from '@loopback/testlab';
import {ActivityLogController} from '../../controllers';
import {ActivityLogType} from '../../enums';
import {ActivityLog} from '../../models';
import {ActivityLogRepository} from '../../repositories';
import {givenActivityLog} from '../helpers';

describe('ActivityLogController', () => {
  let activityLogRepository: StubbedInstanceWithSinonAccessor<ActivityLogRepository>;
  let controller: ActivityLogController;
  let aActivityLogWithId: ActivityLog;
  let aListOfActivityLogs: ActivityLog[];

  beforeEach(resetRepositories);

  describe('findActivities', () => {
    it('returns multiple activities if they exist', async () => {
      const find = activityLogRepository.stubs.find;
      find.resolves(aListOfActivityLogs);
      expect(await controller.find()).to.eql(aListOfActivityLogs);
      sinon.assert.called(find);
    });

    it('returns empty list if no activities exist', async () => {
      const find = activityLogRepository.stubs.find;
      const expected: ActivityLog[] = [];
      find.resolves(expected);
      expect(await controller.find()).to.eql(expected);
      sinon.assert.called(find);
    });

    it('uses the provided filter', async () => {
      const find = activityLogRepository.stubs.find;
      const filter = toJSON({where: {id: '1'}});

      find.resolves(aListOfActivityLogs);
      await controller.find(filter);
      sinon.assert.calledWith(find, filter);
    });
  });

  function resetRepositories() {
    activityLogRepository = createStubInstance(ActivityLogRepository);
    aActivityLogWithId = givenActivityLog({
      id: '1',
    });
    aListOfActivityLogs = [
      aActivityLogWithId,
      givenActivityLog({
        id: '2',
        type: ActivityLogType.CREATEPOST,
        userId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ks',
      }),
    ] as ActivityLog[];

    controller = new ActivityLogController(activityLogRepository);
  }
});
