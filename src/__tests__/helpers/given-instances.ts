import {
  ActivityLogType,
  FriendStatusType,
  ReferenceType,
  NotificationType,
  PlatformType,
  SectionType,
  AccountSettingType,
  PostStatus,
  PermissionKeys,
} from '../../enums';
import {
  AccountSetting,
  ActivityLog,
  Comment,
  CreateImportedPostDto,
  CreateReportDto,
  Credential,
  Currency,
  DraftPost,
  Experience,
  Friend,
  Identity,
  Network,
  Notification,
  NotificationSetting,
  People,
  Post,
  Report,
  RequestCreateNewUserByWallet,
  Server,
  SocialMediaVerificationDto,
  Tag,
  Transaction,
  UnlockableContentWithPrice,
  User,
  UserExperience,
  UserReport,
  UserSocialMedia,
  Vote,
  Wallet,
} from '../../models';
import {
  AccountSettingRepository,
  ActivityLogRepository,
  CommentRepository,
  CurrencyRepository,
  ExperienceRepository,
  FriendRepository,
  IdentityRepository,
  NetworkRepository,
  NotificationRepository,
  NotificationSettingRepository,
  PeopleRepository,
  PostRepository,
  ReportRepository,
  ServerRepository,
  TagRepository,
  TransactionRepository,
  UnlockableContentRepository,
  UserExperienceRepository,
  UserReportRepository,
  UserRepository,
  UserSocialMediaRepository,
  VoteRepository,
  WalletRepository,
} from '../../repositories';
import {PolkadotJs} from '../../utils/polkadot-js';
import {KeyringPair} from '@polkadot/keyring/types';
import {AnyObject} from '@loopback/repository';
import {UserProfile, securityId} from '@loopback/security';
import {promisify} from 'util';
import {config} from '../../config';
import {generateObjectId} from '../../utils/formatter';
import crypto from 'crypto';

const jwt = require('jsonwebtoken');
const signAsync = promisify(jwt.sign);
const {getKeyring, getHexPublicKey} = new PolkadotJs();
const mnemonic =
  'account custom bind hero sleep ugly century tooth seed potato curious always';

export function givenUser(user?: Partial<User>) {
  const data = Object.assign(
    {
      id: generateObjectId(),
      name: 'Abdul Hakim',
      username: 'abdulhakim',
      nonce: 99999999999,
      permissions: [
        PermissionKeys.MASTER,
        PermissionKeys.USER,
        PermissionKeys.ADMIN,
      ],
    },
    user,
  );
  return new User(data);
}

export function givenOtherUser(user?: Partial<User>) {
  const data = Object.assign(
    {
      id: generateObjectId(),
      name: 'Abdul Hakim',
      username: 'otheruser',
      createdAt: new Date(),
      nonce: 99999999999,
      permissions: [PermissionKeys.USER],
    },
    user,
  );
  return new User(data);
}

export async function givenAccesToken(user: User) {
  const userProfile: UserProfile = {
    [securityId]: user.id!.toString(),
    id: user.id,
    name: user.name,
    username: user.username,
    createdAt: user.createdAt,
    permissions: user.permissions,
  };

  return signAsync(userProfile, config.JWT_TOKEN_SECRET_KEY);
}

export async function givenUserInstance(
  userRepository: UserRepository,
  user?: Partial<User>,
) {
  return userRepository.create(givenUser(user));
}

export async function givenMultipleUserInstances(
  userRepository: UserRepository,
) {
  return Promise.all([
    givenUserInstance(userRepository),
    givenUserInstance(userRepository, {
      id: generateObjectId(),
      name: 'irman',
      username: 'irman',
    }),
  ]);
}

export function givenAddress(): KeyringPair {
  return getKeyring().addFromMnemonic(mnemonic);
}

export function givenCredential(credential?: Partial<Credential>) {
  const publicKey = getKeyring().addFromMnemonic(mnemonic);
  const id = getHexPublicKey(publicKey);

  const data = Object.assign(
    {
      publicAddress: id,
      walletType: 'polkadot{.js}',
      networkType: 'polkadot',
      role: 'user',
    },
    credential,
  );
  return new Credential(data);
}

export function givenPeople(people?: Partial<People>) {
  const id = generateObjectId();
  const data = Object.assign(
    {
      id,
      name: 'Elon Musk',
      username: 'elonmusk',
      platform: 'twitter',
      originUserId: '44196397',
      profilePictureURL:
        'https://pbs.twimg.com/profile_images/1383184766959120385/MM9DHPWC_400x400.jpg',
    },
    people,
  );
  return new People(data);
}

export async function givenPeopleInstance(
  peopleRepository: PeopleRepository,
  people?: Partial<People>,
) {
  return peopleRepository.create(givenPeople(people));
}

export async function givenMultiplePeopleInstances(
  peopleRepository: PeopleRepository,
) {
  return Promise.all([
    givenPeopleInstance(peopleRepository),
    givenPeopleInstance(peopleRepository, {
      name: 'Gavin Wood',
      username: 'gavofyork',
      platform: PlatformType.TWITTER,
      originUserId: '33962758',
      profilePictureURL:
        'https://pbs.twimg.com/profile_images/981390758870683656/RxA_8cyN_400x400.jpg',
    }),
  ]);
}

export function givenComment(comment?: Partial<Comment>) {
  const data = Object.assign(
    {
      text: 'Hello world',
      referenceId: '1',
      type: ReferenceType.POST,
      section: SectionType.DISCUSSION,
    },
    comment,
  );
  return new Comment(data);
}

export async function givenCommentInstance(
  commentRepository: CommentRepository,
  comment?: Partial<Comment>,
) {
  return commentRepository.create(givenComment(comment));
}

export async function givenMultipleCommentInstances(
  commentRepository: CommentRepository,
  comment?: Partial<Comment>,
) {
  return Promise.all([
    givenCommentInstance(commentRepository, comment),
    givenCommentInstance(commentRepository, {
      text: 'Hello',
      ...comment,
    }),
  ]);
}

export function givenPost(post?: Partial<DraftPost>) {
  const data = Object.assign(
    {
      tags: ['hello'],
      text: 'hello world',
      createdBy:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
      status: PostStatus.PUBLISHED,
    },
    post,
  );
  return new DraftPost(data);
}

export function givenImportedPost(post?: Partial<Post>) {
  const data = Object.assign(
    {
      tags: [],
      platform: PlatformType.TWITTER,
      title: '',
      text: '"Tesla Solar + Powerwall battery enables consumers to be their own utility"',
      originPostId: '1385108424761872387',
      url: 'https://twitter.com/44196397/status/1385108424761872387',
      originCreatedAt:
        'Thu Apr 22 2021 12:49:17 GMT+0700 (Western Indonesia Time)',
      createdBy:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61864',
    },
    post,
  );
  return new Post(data);
}

export function givenMyriadPost(post?: Partial<Post>) {
  const data = Object.assign(
    {
      tags: ['hello'],
      text: 'hello world',
      createdBy:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
    },
    post,
  );
  return new Post(data);
}

export async function givenMyriadPostInstance(
  postRepository: PostRepository,
  post?: Partial<Post>,
) {
  return postRepository.create(givenMyriadPost(post));
}

export async function givenPostInstance(
  postRepository: PostRepository,
  post?: Partial<Post>,
  setMongo?: boolean,
) {
  if (setMongo) {
    return (postRepository.dataSource.connector as AnyObject)
      .collection(Post.modelName)
      .insertOne(givenImportedPost(post));
  }
  return postRepository.create(givenImportedPost(post));
}

export function givenCurrency(currency?: Partial<Currency>) {
  const data = Object.assign(
    {
      name: 'rococo',
      symbol: 'ROC',
      decimal: 12,
      image: 'https://image.com/rococo.svg',
      native: true,
      exchangeRate: false,
      networkId: 'rococo',
    },
    currency,
  );
  return new Currency(data);
}

export async function givenCurrencyInstance(
  currencyRepository: CurrencyRepository,
  currency?: Partial<Currency>,
) {
  return currencyRepository.create(givenCurrency(currency));
}

export async function givenMultipleCurrencyInstances(
  currencyRepository: CurrencyRepository,
) {
  return Promise.all([
    givenCurrencyInstance(currencyRepository),
    givenCurrencyInstance(currencyRepository, {
      name: 'acala',
      symbol: 'ACA',
      decimal: 12,
      image: 'https://image.com/ausd.svg',
      native: true,
      exchangeRate: true,
      networkId: 'acala',
    }),
  ]);
}

export function givenFriend(friend?: Partial<Friend>) {
  const data = Object.assign(
    {
      status: FriendStatusType.PENDING,
    },
    friend,
  );
  return new Friend(data);
}

export async function givenFriendInstance(
  friendRepository: FriendRepository,
  friend?: Partial<Friend>,
) {
  return friendRepository.create(givenFriend(friend));
}

export async function givenMultipleFriendInstances(
  friendRepository: FriendRepository,
) {
  return Promise.all([
    givenFriendInstance(friendRepository, {
      requesteeId: '1',
      requestorId: '9997',
    }),
    givenFriendInstance(friendRepository, {
      requesteeId: '1',
      requestorId: '9998',
    }),
  ]);
}

export function givenVote(vote?: Partial<Vote>) {
  const data = Object.assign(
    {
      type: ReferenceType.POST,
      state: true,
      referenceId: '1',
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
    },
    vote,
  );
  return new Vote(data);
}

export async function givenVoteInstance(
  voteRepository: VoteRepository,
  vote?: Partial<Vote>,
) {
  return voteRepository.create(givenVote(vote));
}

export function givenNotification(notification?: Partial<Notification>) {
  const data = Object.assign(
    {
      type: NotificationType.FRIEND_REQUEST,
      read: false,
      message: 'sent you a friend request',
      referenceId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61864',
      from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
      to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61864',
    },
    notification,
  );
  return new Notification(data);
}

export async function givenNotificationInstance(
  notificationRepository: NotificationRepository,
  notification?: Partial<Notification>,
) {
  return notificationRepository.create(givenNotification(notification));
}

export async function givenMultipleNotificationInstances(
  notificationRepository: NotificationRepository,
) {
  return Promise.all([
    givenNotificationInstance(notificationRepository),
    givenNotificationInstance(notificationRepository, {
      type: NotificationType.FRIEND_REQUEST,
      read: false,
      message: 'sent you a friend request',
      referenceId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61865',
      from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61866',
      to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61865',
    }),
  ]);
}

export function givenTag(tag?: Partial<Tag>) {
  const data = Object.assign(
    {
      id: 'hello',
      count: 1,
    },
    tag,
  );
  return new Tag(data);
}

export async function givenTagInstance(
  tagRepository: TagRepository,
  tag?: Partial<Tag>,
) {
  return tagRepository.create(givenTag(tag));
}

export async function givenMultipleTagInstances(tagRepository: TagRepository) {
  return Promise.all([
    givenTagInstance(tagRepository),
    givenTagInstance(tagRepository, {
      id: 'blockchain',
      count: 1,
    }),
  ]);
}

export function givenTransaction(transaction?: Partial<Transaction>) {
  const data = Object.assign(
    {
      hash: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61866',
      amount: 1,
      from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61864',
      to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61865',
    },
    transaction,
  );
  return new Transaction(data);
}

export async function givenTransactionInstance(
  transactionRepository: TransactionRepository,
  transaction?: Partial<Transaction>,
) {
  return transactionRepository.create(givenTransaction(transaction));
}

export function givenUserSocialMedia(
  userSocialMedia?: Partial<UserSocialMedia>,
) {
  const data = Object.assign(
    {
      verified: true,
      platform: PlatformType.TWITTER,
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61864',
      peopleId: '1',
    },
    userSocialMedia,
  );
  return new UserSocialMedia(data);
}

export async function givenUserSocialMediaInstance(
  userSocialMediaRepository: UserSocialMediaRepository,
  userSocialMedia?: Partial<UserSocialMedia>,
) {
  return userSocialMediaRepository.create(
    givenUserSocialMedia(userSocialMedia),
  );
}

export function givenPlatformPost(
  createdImportedPostDto?: Partial<CreateImportedPostDto>,
) {
  const data = Object.assign(
    {
      url: 'https://www.reddit.com/r/announcements/comments/nw2hs6/sunsetting_secret_santa_and_reddit_gifts/',
      importer:
        '0x06fc711c1a49ad61d7b615d085723aa7d429b621d324a5513b6e54aea442d94e',
      tags: [],
    },
    createdImportedPostDto,
  );
  return new CreateImportedPostDto(data);
}

export function givenUserVerification(
  userVerification?: Partial<SocialMediaVerificationDto>,
) {
  const data = Object.assign(
    {
      address:
        '0x48c145fb4a5aeb32075023a576180107ecc1e5470ab2ebdd1965b71a33dad363',
      platform: PlatformType.REDDIT,
      username: 'NetworkMyriad',
    },
    userVerification,
  );
  return new SocialMediaVerificationDto(data);
}

export function givenActivityLog(activityLog?: Partial<ActivityLog>) {
  const data = Object.assign(
    {
      type: ActivityLogType.CREATEUSERNAME,
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ks',
    },
    activityLog,
  );
  return new ActivityLog(data);
}

export function givenActivityLogInstance(
  activityLogRepository: ActivityLogRepository,
  activityLog?: Partial<ActivityLog>,
) {
  return activityLogRepository.create(givenActivityLog(activityLog));
}

export async function givenMultipleActivityLogInstances(
  activityLogRepository: ActivityLogRepository,
) {
  return Promise.all([
    givenActivityLogInstance(activityLogRepository),
    givenActivityLogInstance(activityLogRepository, {
      type: ActivityLogType.CREATEPOST,
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61821',
    }),
  ]);
}

export function givenExperience(experience?: Partial<Experience>) {
  const data = Object.assign(
    {
      name: 'to the moon crypto',
      allowedTags: ['blockchain', 'bitcoin'],
      people: [
        {
          id: '60efac8c565ab8004ed28ba7',
          name: 'Gavin Wood',
          username: 'gavofyork',
          platform: 'twitter',
          originUserId: '33962758',
          profilePictureURL:
            'https://pbs.twimg.com/profile_images/981390758870683656/RxA_8cyN_400x400.jpg',
        },
      ],
      description: 'best projects in cryptoverse',
      createdBy:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61821',
    },
    experience,
  );
  return new Experience(data);
}

export function givenExperienceInstance(
  experienceRepository: ExperienceRepository,
  experience?: Partial<Experience>,
) {
  return experienceRepository.create(givenExperience(experience));
}

export async function givenMultipleExperienceInstances(
  experienceRepository: ExperienceRepository,
  createdBy?: string,
) {
  return Promise.all([
    givenExperienceInstance(experienceRepository, {
      createdBy:
        createdBy ??
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61821',
    }),
    givenExperienceInstance(experienceRepository, {
      name: 'cryptocurrency',
      allowedTags: ['cryptocurrency'],
      people: [
        new People({
          id: '60efac8c565ab8004ed28ba7',
          name: 'Gavin Wood',
          username: 'gavofyork',
          platform: PlatformType.TWITTER,
          originUserId: '33962758',
          profilePictureURL:
            'https://pbs.twimg.com/profile_images/981390758870683656/RxA_8cyN_400x400.jpg',
        }),
      ],
      description: 'best projects in cryptoverse',
      createdBy:
        createdBy ??
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61821',
    }),
  ]);
}

export function givenUserExperience(userExperience?: Partial<UserExperience>) {
  const data = Object.assign(
    {
      subscribed: false,
      experienceId: '1',
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61821',
    },
    userExperience,
  );
  return new UserExperience(data);
}

export function givenUserExperienceInstance(
  userExperienceRepository: UserExperienceRepository,
  userExperience?: Partial<UserExperience>,
) {
  return userExperienceRepository.create(givenUserExperience(userExperience));
}

export async function givenMultipleUserExperienceInstances(
  userExperienceRepository: UserExperienceRepository,
) {
  return Promise.all([
    givenUserExperienceInstance(userExperienceRepository),
    givenUserExperienceInstance(userExperienceRepository, {
      subscribed: true,
      experienceId: '2',
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61821',
    }),
  ]);
}

export async function givenCommentInstanceOfPost(
  postRepository: PostRepository,
  id: typeof Post.prototype.id,
  comment?: Partial<Comment>,
) {
  const data: Partial<Comment> = givenComment(comment);
  delete data.referenceId;
  return postRepository.comments(id).create(data);
}

export async function givenCommentInstanceOfComment(
  commentRepository: CommentRepository,
  id: typeof Comment.prototype.id,
  comment?: Partial<Comment>,
) {
  const data: Partial<Comment> = givenComment(comment);
  return commentRepository.comments(id).create(data);
}

export function givenReport(report?: Partial<Report>) {
  const data = Object.assign(
    {
      referenceType: ReferenceType.POST,
      referenceId: '1',
      type: 'Child abuse',
    },
    report,
  );
  return new Report(data);
}

export async function givenReportInstance(
  reportRepository: ReportRepository,
  report?: Partial<Report>,
) {
  return reportRepository.create(givenReport(report));
}

export function givenUserReport(userReport?: Partial<UserReport>) {
  const data = Object.assign(
    {
      reportedBy:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
      reportId: '1',
      description: "I don't like this post",
    },
    userReport,
  );
  return new UserReport(data);
}

export async function givenUserReportInstance(
  userReportRepository: UserReportRepository,
  userReport?: Partial<UserReport>,
) {
  return userReportRepository.create(givenUserReport(userReport));
}

export function givenReportDetail(reportDetail?: Partial<CreateReportDto>) {
  const data = Object.assign(
    {
      referenceType: ReferenceType.USER,
      referenceId: '1',
      description: 'I hate this user',
    },
    reportDetail,
  );
  return new CreateReportDto(data);
}

export function givenNotificationSetting(
  notificationSetting?: Partial<NotificationSetting>,
) {
  const data = Object.assign(
    {
      comments: true,
      mentions: true,
      friendRequests: true,
      tips: true,
    },
    notificationSetting,
  );
  return new NotificationSetting(data);
}

export async function givenNotificationSettingInstance(
  notificationSettingRepository: NotificationSettingRepository,
  notificationSetting?: Partial<NotificationSetting>,
) {
  return notificationSettingRepository.create(
    givenNotificationSetting(notificationSetting),
  );
}

export function givenAccountSetting(accountSetting?: Partial<AccountSetting>) {
  const data = Object.assign(
    {
      accountPrivacy: AccountSettingType.PUBLIC,
      socialMediaPrivacy: AccountSettingType.PUBLIC,
    },
    accountSetting,
  );
  return new AccountSetting(data);
}

export async function givenAccountSettingInstance(
  accountSettingRepository: AccountSettingRepository,
  accountSetting?: Partial<AccountSetting>,
) {
  return accountSettingRepository.create(givenAccountSetting(accountSetting));
}

export function givenWallet(wallet?: Partial<Wallet>) {
  const publicKey = getKeyring().addFromMnemonic(mnemonic);
  const id = getHexPublicKey(publicKey);
  const data = Object.assign(
    {
      id: id,
      networkId: 'myriad',
      blockchainPlatform: 'substrate',
    },
    wallet,
  );
  return new Wallet(data);
}

export function givenWalletInstance(
  walletRepository: WalletRepository,
  wallet?: Partial<Wallet>,
) {
  return walletRepository.create(givenWallet(wallet));
}

export function givenUserWallet(
  userWallet?: Partial<RequestCreateNewUserByWallet>,
) {
  const publicKey = getKeyring().addFromMnemonic(mnemonic);
  const id = getHexPublicKey(publicKey);
  const data = Object.assign(
    {
      name: 'Abdul Hakim',
      username: 'abdulhakim',
      address: id,
      network: 'polkadot',
    },
    userWallet,
  );
  return new RequestCreateNewUserByWallet(data);
}

export function givenNetwork(network?: Partial<Network>) {
  const data = Object.assign(
    {
      id: 'polkadot',
      image: 'https://image.com/polkadot.svg',
      rpcURL: 'wss://rpc.polkadot.io',
      explorerURL:
        'https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Frpc.polkadot.io#/explorer/query',
      blockchainPlatform: 'substrate',
    },
    network,
  );
  return new Network(data);
}

export function givenNetworkInstance(
  networkRepository: NetworkRepository,
  network?: Partial<Network>,
) {
  return networkRepository.create(givenNetwork(network));
}

export function givenServer(server?: Partial<Server>) {
  const serverAdmin = getKeyring().addFromMnemonic(mnemonic);
  const serverId = serverAdmin.address;

  const data = Object.assign(
    {
      id: 0,
      name: 'Myriad Social',
      serverImageURL: 'https://image.com/myriad-logo.svg',
      description: 'Welcome to myriad social',
      accountId: {
        myriad: serverId,
      },
    },
    server,
  );

  return new Server(data);
}

export function givenServerInstance(
  serverRepository: ServerRepository,
  server?: Partial<Server>,
) {
  return serverRepository.create(givenServer(server));
}

export function givenIdentity(identity?: Partial<Identity>) {
  const text = crypto.randomBytes(32).toString('hex');
  const data = Object.assign(
    {
      hash: `0x${text}`,
      expiredAt: Date.now() + 10 * 60 * 1000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    identity,
  );

  return new Identity(data);
}

export function givenIdentityInstance(
  identityRepository: IdentityRepository,
  identity?: Partial<Identity>,
) {
  const key = `social-media/${identity?.userId}`;
  return identityRepository.set(key, givenIdentity(identity));
}

export function givenUnlockableContent(
  unlockableContentWithPrice?: Partial<UnlockableContentWithPrice>,
) {
  const data = Object.assign(
    {
      content: {
        text: 'Hello world',
      },
    },
    unlockableContentWithPrice,
  );
  return new UnlockableContentWithPrice(data);
}

export function givenUnlockableContentInstance(
  unlockableRepository: UnlockableContentRepository,
  unlockableContentWithPrice?: Partial<UnlockableContentWithPrice>,
) {
  return unlockableRepository.create(
    givenUnlockableContent(unlockableContentWithPrice),
  );
}
