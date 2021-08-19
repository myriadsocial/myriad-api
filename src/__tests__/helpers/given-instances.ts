import {Comment, People, Post, User} from '../../models';
import {
  CommentRepository,
  PeopleRepository,
  PostRepository,
  UserRepository,
} from '../../repositories';

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

export async function givenMutlipleUserInstances(userRepository: UserRepository) {
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

export async function givenPostInstance(postRepository: PostRepository, post?: Partial<Post>) {
  return postRepository.create(givenPost(post));
}
