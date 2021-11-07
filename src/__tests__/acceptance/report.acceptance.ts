import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../..';
import {ReferenceType, ReportStatusType, ReportType} from '../../enums';
import {Post, Report, User} from '../../models';
import {
  PostRepository,
  ReportRepository,
  UserRepository,
} from '../../repositories';
import {
  givenPostInstance,
  givenPostRepository,
  givenReportInstance,
  givenReportRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';

describe('ReportApplication', () => {
  let app: MyriadApiApplication;
  let client: Client;
  let reportRepository: ReportRepository;
  let userRepository: UserRepository;
  let postRepository: PostRepository;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    reportRepository = await givenReportRepository(app);
    userRepository = await givenUserRepository(app);
    postRepository = await givenPostRepository(app);
  });

  beforeEach(async () => {
    await reportRepository.deleteAll();
    await userRepository.deleteAll();
    await postRepository.deleteAll();
  });

  context('when dealing with a single persisted report', () => {
    let persistedReport: Report;
    let post: Post;

    beforeEach(async () => {
      post = await givenPostInstance(postRepository);
      persistedReport = await givenReportInstance(reportRepository, {
        referenceType: ReferenceType.POST,
        referenceId: post.id,
        type: ReportType.ABUSIVE,
      });
    });

    it('gets a report by ID', async () => {
      const result = await client
        .get(`/reports/${persistedReport.id}`)
        .send()
        .expect(200);
      const expected = toJSON(persistedReport);
      expect(result.body).to.deepEqual({
        ...expected,
      });
    });

    it('returns 404 when getting a report that does not exist', () => {
      return client.get('/reports/99999').expect(404);
    });

    it('updates the reports by ID ', async () => {
      const updatedReport: Partial<Report> = new Report({
        status: ReportStatusType.REMOVED,
      });

      await client
        .patch(`/reports/${persistedReport.id}`)
        .send(updatedReport)
        .expect(204);
      const result = await reportRepository.findById(persistedReport.id ?? '');
      expect(result).to.containEql(updatedReport);
    });

    it('deletes the report', async () => {
      await client.del(`/reports/${persistedReport.id}`).send().expect(204);
      await expect(
        reportRepository.findById(persistedReport.id),
      ).to.be.rejectedWith(EntityNotFoundError);
    });

    it('returns 404 when deleting a report that does not exist', async () => {
      await client.del(`/reports/99999`).expect(404);
    });
  });

  context('when dealing with multiple persisted reports', () => {
    let persistedReports: Report[];
    let post: Post;
    let user: User;

    beforeEach(async () => {
      post = await givenPostInstance(postRepository);
      user = await givenUserInstance(userRepository, {
        id: '0x06cc7ed22ebd12ccd88fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
      });

      persistedReports = await Promise.all([
        givenReportInstance(reportRepository, {
          referenceType: ReferenceType.POST,
          referenceId: post.id,
          type: ReportType.ABUSIVE,
        }),
        givenReportInstance(reportRepository, {
          referenceType: ReferenceType.USER,
          referenceId: user.id,
        }),
      ]);
    });

    it('finds all reports', async () => {
      const response = await client.get('/reports').send().expect(200);
      expect(response.body.data).to.containDeep(toJSON(persistedReports));
    });

    it('queries reports with a filter', async () => {
      const reportInProgress: Partial<Report> = await givenReportInstance(
        reportRepository,
        {
          referenceId: post.id,
          referenceType: ReferenceType.POST,
          type: ReportType.CHILDEXPLOITATION,
        },
      );

      await client
        .get('/reports')
        .query(
          'filter=' +
            JSON.stringify({where: {type: ReportType.CHILDEXPLOITATION}}),
        )
        .expect(200, {
          data: [toJSON({...reportInProgress})],
          meta: {
            currentPage: 1,
            itemsPerPage: 1,
            totalItemCount: 1,
            totalPageCount: 1,
          },
        });
    });

    it('exploded filter conditions work', async () => {
      const response = await client.get('/reports').query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });
});
