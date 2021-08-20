import {FriendStatusType, LikeType, NotificationType, PlatformType} from '../../enums';
import {
  Comment,
  Currency,
  Friend,
  Like,
  Notification,
  People,
  Post,
  Tag,
  Transaction,
  User,
  UserCurrency,
  UserSocialMedia,
} from '../../models';
import {
  CommentRepository,
  CurrencyRepository,
  FriendRepository,
  LikeRepository,
  NotificationRepository,
  PeopleRepository,
  PostRepository,
  TagRepository,
  TransactionRepository,
  UserCurrencyRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../../repositories';

/* eslint-disable  @typescript-eslint/no-explicit-any */
export function givenUser(user?: Partial<User>) {
  const data = Object.assign(
    {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61859',
      name: 'Abdul Hakim',
    },
    user,
  );
  return new User(data);
}

export async function givenUserInstance(userRepository: UserRepository, user?: Partial<User>) {
  return userRepository.create(givenUser(user));
}

export async function givenMultipleUserInstances(userRepository: UserRepository) {
  return Promise.all([
    givenUserInstance(userRepository),
    givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
      name: 'irman',
    }),
  ]);
}

export function givenPeople(people?: Partial<People>) {
  const data = Object.assign(
    {
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

export async function givenMultiplePeopleInstances(peopleRepository: PeopleRepository) {
  return Promise.all([
    givenPeopleInstance(peopleRepository),
    givenPeopleInstance(peopleRepository, {
      name: 'Gavin Wood',
      username: 'gavofyork',
      platform: 'twitter',
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

export function givenPost(post?: Partial<Post>) {
  const data = Object.assign(
    {
      tags: [],
      platform: 'twitter',
      title: '',
      text: 'Tesla Solar + Powerwall battery enables consumers to be their own utility',
      originPostId: '1385108424761872387',
      url: 'https://twitter.com/44196397/status/1385108424761872387',
      originCreatedAt: 'Thu Apr 22 2021 12:49:17 GMT+0700 (Western Indonesia Time)',
      createdBy: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61864',
    },
    post,
  );
  return new Post(data);
}

export function givenMyriadPost(post?: Partial<Post>) {
  const data = Object.assign(
    {
      tags: ['hello', 'world'],
      text: 'hello world',
      platform: PlatformType.MYRIAD,
      createdBy: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
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
    return (postRepository.dataSource.connector as any)
      .collection(Post.modelName)
      .insertOne(givenPost(post));
  }
  return postRepository.create(givenPost(post));
}

export function givenCurrency(currency?: Partial<Currency>) {
  const data = Object.assign(
    {
      id: 'AUSD',
      name: 'ausd',
      decimal: 12,
      image: 'https://apps.acala.network/static/media/AUSD.439bc3f2.png',
      addressType: 42,
      native: false,
      rpcURL: 'wss://acala-mandala.api.onfinality.io/public-ws',
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

export async function givenMultipleCurrencyInstances(currencyRepository: CurrencyRepository) {
  return Promise.all([
    givenCurrencyInstance(currencyRepository),
    givenCurrencyInstance(currencyRepository, {
      id: 'ACA',
      name: 'acala',
      decimal: 13,
      image: 'https://apps.acala.network/static/media/AUSD.439bc3f2.png',
      addressType: 42,
      native: true,
      rpcURL: 'wss://acala-mandala.api.onfinality.io/public-ws',
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

export async function givenMultipleFriendInstances(friendRepository: FriendRepository) {
  return Promise.all([
    givenFriendInstance(friendRepository, {
      requesteeId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61860',
      requestorId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61861',
    }),
    givenFriendInstance(friendRepository, {
      requesteeId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61862',
      requestorId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
    }),
  ]);
}

export function givenLike(like?: Partial<Like>) {
  const data = Object.assign(
    {
      type: LikeType.POST,
      state: true,
      referenceId: '1',
      userId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
    },
    like,
  );
  return new Like(data);
}

export async function givenLikeInstance(likeRepository: LikeRepository, like?: Partial<Like>) {
  return likeRepository.create(givenLike(like));
}

export function givenNotification(notification?: Partial<Notification>) {
  const data = Object.assign(
    {
      type: NotificationType.FRIEND_REQUEST,
      read: false,
      message: 'sent you friend request',
      referenceId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61864',
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
      message: 'sent you friend request',
      referenceId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61865',
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

export async function givenTagInstance(tagRepository: TagRepository, tag?: Partial<Tag>) {
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
      currencyId: 'AUSD',
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

export function givenUserCurrency(userCurrency?: Partial<UserCurrency>) {
  const data = Object.assign(
    {
      userId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61864',
      currencyId: 'AUSD',
    },
    userCurrency,
  );
  return new UserCurrency(data);
}

export async function givenUserCurrencyInstance(
  userCurrencyRepository: UserCurrencyRepository,
  userCurrency?: Partial<UserCurrency>,
) {
  return userCurrencyRepository.create(givenUserCurrency(userCurrency));
}

export function givenUserSocialMedia(userSocialMedia?: Partial<UserSocialMedia>) {
  const data = Object.assign(
    {
      verified: true,
      platform: PlatformType.TWITTER,
      userId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61864',
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
  return userSocialMediaRepository.create(givenUserSocialMedia(userSocialMedia));
}
