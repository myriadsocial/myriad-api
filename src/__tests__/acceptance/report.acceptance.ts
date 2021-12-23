import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../..';
import {ReferenceType, ReportStatusType, ReportType} from '../../enums';
import {Post, Report, User} from '../../models';
import {
  PostRepository,
  ReportRepository,
  UserRepository,
  AuthenticationRepository,
} from '../../repositories';
import {
  givenPostInstance,
  givenPostRepository,
  givenReportInstance,
  givenReportRepository,
  givenUserInstance,
  givenUserRepository,
  givenAuthenticationRepository,
  setupApplication,
} from '../helpers';

describe('ReportApplication', () => {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let reportRepository: ReportRepository;
  let userRepository: UserRepository;
  let postRepository: PostRepository;
  let authenticationRepository: AuthenticationRepository;

  const userCredential = {
    email: 'admin@mail.com',
    password: '123456',
  };

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    reportRepository = await givenReportRepository(app);
    userRepository = await givenUserRepository(app);
    postRepository = await givenPostRepository(app);
    authenticationRepository = await givenAuthenticationRepository(app);
  });

  after(async () => {
    await authenticationRepository.deleteAll();
  });

  beforeEach(async () => {
    await reportRepository.deleteAll();
    await userRepository.deleteAll();
    await postRepository.deleteAll();
  });

  it('sign up successfully', async () => {
    await client.post('/signup').send(userCredential).expect(200);
  });

  it('user login successfully', async () => {
    const res = await client.post('/login').send(userCredential).expect(200);
    token = res.body.accessToken;
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

    it('updates the reports by ID ', async () => {
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
    let user: User;

    beforeEach(async () => {
      post = await givenPostInstance(postRepository);
      user = await givenUserInstance(userRepository);

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
