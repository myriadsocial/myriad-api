import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../..';
import {ReferenceType, ReportStatusType, ReportType} from '../../enums';
import {Post, Report, User} from '../../models';
import {
  PostRepository,
  ReportRepository,
  UserRepository,
  WalletRepository,
} from '../../repositories';
import {
  deleteAllRepository,
  givenAccesToken,
  givenOtherUser,
  givenPostInstance,
  givenPostRepository,
  givenReportInstance,
  givenReportRepository,
  givenUserInstance,
  givenUserRepository,
  givenWalletInstance,
  givenWalletRepository,
  setupApplication,
} from '../helpers';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('ReportApplication', function () {
  this.timeout(20000);

  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let reportRepository: ReportRepository;
  let userRepository: UserRepository;
  let postRepository: PostRepository;
  let walletRepository: WalletRepository;
  let user: User;
  let otherUser: User;

  before(async () => {
    ({app, client} = await setupApplication(true));
  });

  after(() => app.stop());

  before(async () => {
    reportRepository = await givenReportRepository(app);
    userRepository = await givenUserRepository(app);
    postRepository = await givenPostRepository(app);
    walletRepository = await givenWalletRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    token = await givenAccesToken(user);
    otherUser = await givenUserInstance(userRepository, givenOtherUser());

    await givenWalletInstance(walletRepository, {userId: user.id});
  });

  beforeEach(async () => {
    await reportRepository.deleteAll();
  });

  after(async () => {
    await deleteAllRepository(app);
  });

  context('when dealing with a single persisted report', () => {
    let persistedReport: Report;
    let post: Post;
    let anotherUser: User;

    beforeEach(async () => {
      anotherUser = await givenUserInstance(userRepository);
      post = await givenPostInstance(postRepository, {
        createdBy: anotherUser.id,
      });
      persistedReport = await givenReportInstance(reportRepository, {
        referenceType: ReferenceType.POST,
        referenceId: post.id,
        type: ReportType.ABUSIVE,
      });
    });

    it('gets a report by ID', async () => {
      const result = await client
        .get(`/reports/${persistedReport.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      const expected = toJSON(persistedReport);
      expect(result.body).to.deepEqual({
        ...expected,
      });
    });

    it('returns 404 when getting a report that does not exist', () => {
      return client
        .get('/reports/99999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('returns 401 when updating the reports by ID not as login user', async () => {
      const accessToken = await givenAccesToken(otherUser);
      const updatedReport: Partial<Report> = new Report({
        status: ReportStatusType.REMOVED,
      });

      await client
        .patch(`/reports/${persistedReport.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updatedReport)
        .expect(403);
    });

    it('updates the reports by ID', async () => {
      const updatedReport: Partial<Report> = new Report({
        status: ReportStatusType.REMOVED,
      });

      await client
        .patch(`/reports/${persistedReport.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedReport)
        .expect(204);
      const result = await reportRepository.findById(persistedReport.id ?? '');
      expect(result).to.containEql(updatedReport);
    });

    it('returns 401 when deleting the reports by ID not as login user', async () => {
      const accessToken = await givenAccesToken(otherUser);

      await client
        .del(`/reports/${persistedReport.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(403);
    });

    it('deletes the report', async () => {
      await client
        .del(`/reports/${persistedReport.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(204);
      await expect(
        reportRepository.findById(persistedReport.id),
      ).to.be.rejectedWith(EntityNotFoundError);
    });

    it('returns 404 when deleting a report that does not exist', async () => {
      await client
        .del(`/reports/99999`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  context('when dealing with multiple persisted reports', () => {
    let persistedReports: Report[];
    let post: Post;

    beforeEach(async () => {
      post = await givenPostInstance(postRepository);

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
      const response = await client
        .get('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
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
        .set('Authorization', `Bearer ${token}`)
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
      const response = await client
        .get('/reports')
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });
});
