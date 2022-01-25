import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../..';
import {ReferenceType, ReportStatusType, ReportType} from '../../enums';
import {Credential, Post, Report, User} from '../../models';
import {
  PostRepository,
  ReportRepository,
  UserRepository,
} from '../../repositories';
import {
  givenAccesToken,
  givenAddress,
  givenOtherUser,
  givenPostInstance,
  givenPostRepository,
  givenReportInstance,
  givenReportRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';
import {u8aToHex, numberToHex} from '@polkadot/util';
import {KeyringPair} from '@polkadot/keyring/types';

describe('ReportApplication', () => {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let reportRepository: ReportRepository;
  let userRepository: UserRepository;
  let postRepository: PostRepository;
  let nonce: number;
  let user: User;
  let otherUser: User;
  let address: KeyringPair;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    reportRepository = await givenReportRepository(app);
    userRepository = await givenUserRepository(app);
    postRepository = await givenPostRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    address = givenAddress();
    otherUser = await givenUserInstance(userRepository, givenOtherUser());
  });

  beforeEach(async () => {
    await reportRepository.deleteAll();
    await postRepository.deleteAll();
  });

  after(async () => {
    await userRepository.deleteAll();
  });

  it('gets user nonce', async () => {
    const response = await client.get(`/users/${user.id}/nonce`).expect(200);

    nonce = response.body.nonce;
  });

  it('user login successfully', async () => {
    const credential: Credential = new Credential({
      nonce: nonce,
      publicAddress: user.id,
      signature: u8aToHex(address.sign(numberToHex(nonce))),
    });

    const res = await client.post('/login').send(credential).expect(200);
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

    it('returns 401 when updating the reports by ID not as login user', async () => {
      const accessToken = await givenAccesToken(otherUser);
      const updatedReport: Partial<Report> = new Report({
        status: ReportStatusType.REMOVED,
      });

      await client
        .patch(`/reports/${persistedReport.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updatedReport)
        .expect(401);
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
        .expect(401);
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
