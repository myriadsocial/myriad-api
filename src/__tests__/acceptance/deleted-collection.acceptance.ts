import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../..';
import {Post, User} from '../../models';
import {PostRepository, UserRepository} from '../../repositories';
import {
  givenPost,
  givenPostInstance,
  givenPostRepository,
  givenUser,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('DeletedCollectionApplication', () => {
  let app: MyriadApiApplication;
  let client: Client;
  let userRepository: UserRepository;
  let postRepository: PostRepository;

  before(async () => {
    ({app, client} = await setupApplication(true));
  });

  after(() => app.stop());

  before(async () => {
    postRepository = await givenPostRepository(app);
    userRepository = await givenUserRepository(app);
  });

  context('when dealing with user collection', function () {
    this.timeout(20000);

    beforeEach(async () => {
      await userRepository.deleteAll();
    });

    context('when dealing with multiple persisted deleted users', () => {
      let deletedPersistedUsers: User[];

      beforeEach(async () => {
        deletedPersistedUsers = await Promise.all([
          givenUserInstance(userRepository, {deletedAt: new Date().toString()}),
          givenUserInstance(userRepository, {
            id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d12a5fef48b915e8449ee61863',
            deletedAt: new Date().toString(),
          }),
        ]);
      });

      it('finds all deleted users', async () => {
        const response = await client.get('/users/deleted').send().expect(200);
        expect(toJSON(response.body.data)).to.containDeep(
          toJSON(deletedPersistedUsers),
        );
      });

      it('queries deleted users with a filter', async () => {
        const deletedUserInProgress = await givenUserInstance(userRepository, {
          id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d12a5fef48b915e7649ee61863',
          deletedAt: new Date().toString(),
        });

        await client
          .get('/users/deleted')
          .query(
            'filter=' + JSON.stringify({where: {id: deletedUserInProgress.id}}),
          )
          .expect(200, {
            data: [toJSON(deletedUserInProgress)],
            meta: {
              currentPage: 1,
              itemsPerPage: 1,
              totalItemCount: 1,
              totalPageCount: 1,
            },
          });
      });

      it('exploded filter condition work', async () => {
        await givenUserInstance(userRepository, {
          id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d12a5fef48b915e7649ee618s2',
          deletedAt: new Date().toString(),
        });

        const response = await client
          .get('/users/deleted')
          .query('pageLimit=2');
        expect(response.body.data).to.have.length(2);
      });
    });

    context('when dealing with single persisted deleted users', () => {
      let deletedPersistedUser: User;

      beforeEach(async () => {
        deletedPersistedUser = await givenUserInstance(userRepository, {
          deletedAt: new Date().toString(),
        });
      });

      it('gets a deleted user by ID', async () => {
        const result = await client
          .get(`/users/${deletedPersistedUser.id}/deleted`)
          .send()
          .expect(200);
        const expected = toJSON(deletedPersistedUser);

        expect(result.body).to.deepEqual(expected);
      });

      it('returns 404 when getting a deleted user that does not exist', () => {
        return client.get('/users/99999/deleted').expect(404);
      });

      it('recovers the deleted user by ID', async () => {
        const recoveredUser: Partial<User> = givenUser();

        await client
          .patch(`/users/${deletedPersistedUser.id}/recover`)
          .send()
          .expect(204);
        const result = await userRepository.findById(deletedPersistedUser.id);
        expect(result).to.containEql(recoveredUser);
      });

      it('returns 404 when recovering a deleted user that does not exist', () => {
        return client.patch('/users/99999/deleted').send().expect(404);
      });

      it('soft deleted the user', async () => {
        const user = await givenUserInstance(userRepository, {
          id: '0x06cc7ed22ebd12ccc28gb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
        });
        await client.del(`/users/${user.id}/delete`).send().expect(204);
        const result = await userRepository.findById(user.id);
        expect(result).to.have.ownProperty('deletedAt');
      });

      it('returns 404 when deleting a user that does not exist', async () => {
        await client.del(`/users/99999/delete`).expect(404);
      });
    });
  });

  context('when dealing with post collection', function () {
    this.timeout(20000);

    beforeEach(async () => {
      await postRepository.deleteAll();
    });

    context('when dealing with multiple persisted deleted posts', () => {
      let deletedPersistedPosts: Post[];

      beforeEach(async () => {
        deletedPersistedPosts = await Promise.all([
          givenPostInstance(postRepository, {deletedAt: new Date().toString()}),
          givenPostInstance(postRepository, {deletedAt: new Date().toString()}),
        ]);
      });

      it('finds all deleted posts', async () => {
        const response = await client.get('/posts/deleted').send().expect(200);
        expect(toJSON(response.body.data)).to.containDeep(
          toJSON(deletedPersistedPosts),
        );
      });

      it('queries deleted posts with a filter', async () => {
        const deletedPostInProgress = await givenPostInstance(postRepository, {
          deletedAt: new Date().toString(),
        });

        await client
          .get('/posts/deleted')
          .query(
            'filter=' + JSON.stringify({where: {id: deletedPostInProgress.id}}),
          )
          .expect(200, {
            data: [toJSON(deletedPostInProgress)],
            meta: {
              currentPage: 1,
              itemsPerPage: 1,
              totalItemCount: 1,
              totalPageCount: 1,
            },
          });
      });

      it('exploded filter condition work', async () => {
        await givenPostInstance(postRepository, {
          deletedAt: new Date().toString(),
        });

        const response = await client
          .get('/posts/deleted')
          .query('pageLimit=2');
        expect(response.body.data).to.have.length(2);
      });
    });

    context('when dealing with single persisted deleted posts', () => {
      let deletedPersistedPost: Post;

      beforeEach(async () => {
        deletedPersistedPost = await givenPostInstance(postRepository, {
          deletedAt: new Date().toString(),
        });
      });

      it('gets a deleted post by ID', async () => {
        const result = await client
          .get(`/posts/${deletedPersistedPost.id}/deleted`)
          .send()
          .expect(200);
        const expected = toJSON(deletedPersistedPost);

        expect(result.body).to.deepEqual(expected);
      });

      it('returns 404 when getting a deleted post that does not exist', () => {
        return client.get('/posts/99999/deleted').expect(404);
      });

      it('recovers the deleted post by ID', async () => {
        const recoveredPost: Partial<Post> = givenPost();

        await client
          .patch(`/posts/${deletedPersistedPost.id}/recover`)
          .send()
          .expect(204);
        const result = await postRepository.findById(deletedPersistedPost.id);
        delete result.originCreatedAt;
        delete recoveredPost.originCreatedAt;
        expect(result).to.containEql(toJSON(recoveredPost));
      });

      it('returns 404 when recovering a deleted posts that does not exist', () => {
        return client.patch('/posts/99999/deleted').send().expect(404);
      });

      it('soft deleted the post', async () => {
        const post = await givenPostInstance(postRepository);
        await client.del(`/posts/${post.id}/delete`).send().expect(204);
        const result = await postRepository.findById(post.id);
        expect(result).to.have.ownProperty('deletedAt');
      });

      it('returns 404 when deleting a post that does not exist', async () => {
        await client.del(`/posts/99999/delete`).expect(404);
      });
    });
  });
});
