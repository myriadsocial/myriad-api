import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../..';
import {ReferenceType} from '../../enums';
import {
  ReportRepository,
  UserReportRepository,
  UserRepository,
} from '../../repositories';
import {
  givenAddress,
  givenReportInstance,
  givenReportRepository,
  givenUserInstance,
  givenUserReportInstance,
  givenUserReportRepository,
  givenUserRepository,
  setupApplication,
} from '../helpers';
import {u8aToHex, numberToHex} from '@polkadot/util';
import {KeyringPair} from '@polkadot/keyring/types';
import {Credential, User} from '../../models';

describe('ReportUserApplication', () => {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let reportRepository: ReportRepository;
  let userRepository: UserRepository;
  let userReportRepository: UserReportRepository;
  let nonce: number;
  let reporter: User;
  let address: KeyringPair;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    reportRepository = await givenReportRepository(app);
    userReportRepository = await givenUserReportRepository(app);
    userRepository = await givenUserRepository(app);
  });

  before(async () => {
    reporter = await givenUserInstance(userRepository);
    address = givenAddress();
  });

  beforeEach(async () => {
    await reportRepository.deleteAll();
    await userReportRepository.deleteAll();
  });

  after(async () => {
    await userRepository.deleteAll();
  });

  it('gets user nonce', async () => {
    const response = await client
      .get(`/users/${reporter.id}/nonce`)
      .expect(200);

    nonce = response.body.nonce;
  });

  it('user login successfully', async () => {
    const credential: Credential = new Credential({
      nonce: nonce,
      publicAddress: reporter.id,
      signature: u8aToHex(address.sign(numberToHex(nonce))),
    });

    const res = await client.post('/login').send(credential).expect(200);
    token = res.body.accessToken;
  });

  it('gets all reporters from a report', async () => {
    const report = await givenReportInstance(reportRepository);
    const userReport = await givenUserReportInstance(userReportRepository, {
      reportId: report.id,
      reportedBy: reporter.id,
      referenceType: ReferenceType.USER,
    });
    const response = await client
      .get(`/reports/${report.id}/users`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(200);
    expect(response.body.data).to.deepEqual([
      toJSON({
        ...userReport,
        reporter: reporter,
      }),
    ]);
  });
});
