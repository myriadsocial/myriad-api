import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../..';
import {ReferenceType} from '../../enums';
import {
  ReportRepository,
  UserReportRepository,
  UserRepository,
} from '../../repositories';
import {
  givenAccesToken,
  givenAddress,
  givenOtherUser,
  givenReportDetail,
  givenReportRepository,
  givenUserInstance,
  givenUserReportRepository,
  givenUserRepository,
  setupApplication,
} from '../helpers';
import {u8aToHex, numberToHex} from '@polkadot/util';
import {KeyringPair} from '@polkadot/keyring/types';
import {Credential, User} from '../../models';

describe('UserReportApplication', () => {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let reportRepository: ReportRepository;
  let userReportRepository: UserReportRepository;
  let userRepository: UserRepository;
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
    userReportRepository = await givenUserReportRepository(app);
    userRepository = await givenUserRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    address = givenAddress();
    otherUser = await givenUserInstance(userRepository, givenOtherUser());
  });

  beforeEach(async () => {
    await reportRepository.deleteAll();
    await userReportRepository.deleteAll();
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

  it('returns when creating a report not as login user', async () => {
    const accessToken = await givenAccesToken(otherUser);
    const reportedUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b245e8449ee61861',
    });
    const reportDetail = givenReportDetail({referenceId: reportedUser.id});
    await client
      .post(`/users/${user.id}/reports`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(reportDetail)
      .expect(401);
  });

  it('creates a report', async () => {
    const reportedUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61861',
    });
    const reportDetail = givenReportDetail({referenceId: reportedUser.id});
    const response = await client
      .post(`/users/${user.id}/reports`)
      .set('Authorization', `Bearer ${token}`)
      .send(reportDetail)
      .expect(200);
    const result = await reportRepository.findById(response.body.id);
    expect({
      ...response.body,
      totalReported: 1,
    }).to.containDeep(toJSON(result));
    expect(response.body).to.containDeep({
      referenceType: reportDetail.referenceType,
      referenceId: reportDetail.referenceId,
    });

    const [userReportesult] = await userReportRepository.find();
    expect(userReportesult).to.containEql({
      reportedBy: user.id,
      reportId: response.body.id,
      description: reportDetail.description,
    });
  });

  it('rejects reporting a post when type is empty', async () => {
    const reportDetail = givenReportDetail({referenceType: ReferenceType.POST});

    await client
      .post(`/users/${user.id}/reports`)
      .set('Authorization', `Bearer ${token}`)
      .send(reportDetail)
      .expect(422);
  });
});
