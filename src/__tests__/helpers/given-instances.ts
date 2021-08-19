import {FriendStatusType, LikeType} from '../../enums';
import {Comment, Currency, Friend, Like, People, Post, User} from '../../models';
import {
  CommentRepository,
  CurrencyRepository,
  FriendRepository,
  LikeRepository,
  PeopleRepository,
  PostRepository,
  UserRepository,
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

export async function givenMutliplePeopleInstances(peopleRepository: PeopleRepository) {
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

export async function givenMutlipleCommentInstances(
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
    },
    post,
  );
  return new Post(data);
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

export async function givenMutlipleCurrencyInstances(currencyRepository: CurrencyRepository) {
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

export async function givenMutlipleFriendInstances(friendRepository: FriendRepository) {
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
