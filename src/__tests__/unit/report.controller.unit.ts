import {
  createStubInstance,
  expect,
  sinon,
  StubbedInstanceWithSinonAccessor,
  toJSON,
} from '@loopback/testlab';
import {ReportController} from '../../controllers';
import {ReferenceType, ReportType} from '../../enums';
import {Report} from '../../models';
import {ReportRepository} from '../../repositories';
import {NotificationService} from '../../services';
import {givenReport} from '../helpers';

describe('ReportController', () => {
  let reportRepository: StubbedInstanceWithSinonAccessor<ReportRepository>;
  let notificationService: NotificationService;
  let controller: ReportController;
  let aReportWithId: Report;
  let aListOfReports: Report[];

  beforeEach(resetRepositories);

  describe('findReportById', () => {
    it('returns a report if it exists', async () => {
      const findById = reportRepository.stubs.findById;
      findById.resolves(aReportWithId);
      expect(await controller.findById(aReportWithId.id as string, {})).to.eql(
        aReportWithId,
      );
      sinon.assert.calledWith(findById, aReportWithId.id);
    });
  });

  describe('findReports', () => {
    it('returns multiple reports if they exist', async () => {
      const find = reportRepository.stubs.find;
      find.resolves(aListOfReports);
      expect(await controller.find({})).to.eql(aListOfReports);
      sinon.assert.called(find);
    });

    it('returns empty list if no reports exist', async () => {
      const find = reportRepository.stubs.find;
      const expected: Report[] = [];
      find.resolves(expected);
      expect(await controller.find({})).to.eql(expected);
      sinon.assert.called(find);
    });

    it('uses the provided filter', async () => {
      const find = reportRepository.stubs.find;
      const filter = toJSON({where: {type: 'other'}});

      find.resolves(aListOfReports);
      await controller.find(filter);
      sinon.assert.calledWith(find, filter);
    });
  });

  describe('deleteReport', () => {
    it('successfully deletes existing items', async () => {
      const deleteById = reportRepository.stubs.deleteById;
      deleteById.resolves();
      await controller.restore(aReportWithId.id as string);
      sinon.assert.calledWith(deleteById, aReportWithId.id);
    });
  });

  function resetRepositories() {
    reportRepository = createStubInstance(ReportRepository);
    aReportWithId = givenReport({
      id: '1',
    });
    aListOfReports = [
      aReportWithId,
      givenReport({
        id: '2',
        referenceType: ReferenceType.POST,
        referenceId: '2',
        type: ReportType.ABUSIVE,
        totalReported: 1,
      }),
    ] as Report[];

    controller = new ReportController(reportRepository, notificationService);
  }
});
