import {AnyObject, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {ExtendedPost} from '../interfaces';
import {DraftPost, Post, PostWithRelations, User} from '../models';
import {
  PeopleRepository,
  PostRepository,
  CommentRepository,
  FriendRepository,
  VoteRepository,
  DraftPostRepository,
} from '../repositories';
import {injectable, BindingScope, service, inject} from '@loopback/core';
import {BcryptHasher} from './authentication/hash.password.service';
import {config} from '../config';
import {FriendStatusType, PlatformType, VisibilityType} from '../enums';
import {MetricService} from '../services';
import {UrlUtils} from '../utils/url.utils';
import _ from 'lodash';
import {PlatformPost} from '../models/platform-post.model';
import {AuthenticationBindings} from '@loopback/authentication';
import {UserProfile, securityId} from '@loopback/security';

const urlUtils = new UrlUtils();
const {validateURL, getOpenGraph} = urlUtils;

@injectable({scope: BindingScope.TRANSIENT})
export class PostService {
  constructor(
    @repository(PostRepository)
    public postRepository: PostRepository,
    @repository(DraftPostRepository)
    public draftPostRepository: DraftPostRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
    @repository(VoteRepository)
    protected voteRepository: VoteRepository,
    @service(MetricService)
    protected metricService: MetricService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    protected currentUser: UserProfile,
  ) {}

  async createPost(post: Omit<ExtendedPost, 'id'>): Promise<PostWithRelations> {
    const {platformUser, platform} = post;

    if (!platformUser)
      throw new HttpErrors.NotFound('Platform user not found!');

    let people = await this.peopleRepository.findOne({
      where: {
        originUserId: platformUser.originUserId,
        platform: platform,
      },
    });

    if (!people) {
      people = await this.peopleRepository.create(platformUser);

      const hasher = new BcryptHasher();
      const hashPeopleId = await hasher.hashPassword(
        people.id + config.MYRIAD_ESCROW_SECRET_KEY,
      );

      await this.peopleRepository.updateById(people.id, {
        walletAddressPassword: hashPeopleId,
      });
    }

    delete post.platformUser;

    const newPost: PostWithRelations = await this.postRepository.create(
      Object.assign(post, {peopleId: people.id}),
    );

    return Object.assign(newPost, {people: people});
  }

  async deletePost(id: string): Promise<void> {
    const {createdBy} = await this.postRepository.findById(id);

    await this.postRepository.deleteById(id);
    await this.commentRepository.deleteAll({
      postId: id,
    });
    await this.metricService.userMetric(createdBy);
  }

  async getPostImporterInfo(
    post: AnyObject,
    userId?: string,
  ): Promise<AnyObject> {
    const found = await this.postRepository.findOne({
      where: <AnyObject>{
        originPostId: post.originPostId ?? '',
        platform: post.platform,
        deletedAt: {
          $exists: true,
        },
      },
    });

    if (found) post.text = '[this post is unavailable]';
    if (post.deletedAt) post.text = '[post removed]';
    if (post.platform === PlatformType.MYRIAD) return post;
    if (post.platform === PlatformType.REDDIT) {
      post.title = post.title.substring(1, post.text.length - 1);
    }

    post.text = post.text.substring(1, post.text.length - 1);

    if (!post.user) return post;
    if (!userId) return post;

    const importer = new User({...post.user});

    if (userId === post.createdBy) {
      importer.name = 'You';
    }

    return {...post, importers: [importer]};
  }

  async createDraftPost(draftPost: DraftPost): Promise<DraftPost> {
    let url = '';
    let embeddedURL = null;

    if (draftPost.text) {
      const found = draftPost.text.match(/https:\/\/|http:\/\/|www./g);
      if (found) {
        const index: number = draftPost.text.indexOf(found[0]);

        for (let i = index; i < draftPost.text.length; i++) {
          const letter = draftPost.text[i];

          if (letter === ' ' || letter === '"') break;
          url += letter;
        }
      }

      try {
        if (url) validateURL(url);
        embeddedURL = await getOpenGraph(url);
      } catch {
        // ignore
      }

      if (embeddedURL) {
        draftPost.embeddedURL = embeddedURL;
      }
    }

    if (draftPost.tags && draftPost.tags.length > 0) {
      draftPost.tags = draftPost.tags.map(tag => tag.toLowerCase());
    }

    const found = await this.draftPostRepository.findOne({
      where: {
        createdBy: draftPost.createdBy,
      },
    });

    if (found) {
      await this.draftPostRepository.updateById(found.id, draftPost);

      return Object.assign(draftPost, {id: found.id});
    }

    return this.draftPostRepository.create(draftPost);
  }

  async createPublishPost(draftPost: DraftPost): Promise<Post> {
    await this.draftPostRepository.deleteById(draftPost.id);

    const newPost = _.omit(draftPost, ['id', 'status']);
    return this.postRepository.create({
      ...newPost,
      platform: PlatformType.MYRIAD,
    });
  }

  async findImportedPost(
    platformPost: PlatformPost,
  ): Promise<ExtendedPost | undefined> {
    const [platform, originPostId] = platformPost.url.split(',');
    const importer = platformPost.importer;

    const posts = await this.postRepository.find({
      where: {
        or: [
          {
            originPostId,
            platform: platform as PlatformType,
          },
          {
            originPostId,
            platform: platform as PlatformType,
            createdBy: importer,
          },

          <AnyObject>{
            originPostId,
            platform: platform as PlatformType,
            deletedAt: {
              $exists: true,
            },
          },
        ],
      },
      include: ['people'],
      limit: 5,
    });

    const hasBeenDeleted = posts.find(e => e.deletedAt);

    if (hasBeenDeleted) {
      throw new HttpErrors.UnprocessableEntity(
        'You cannot import deleted post',
      );
    }

    const hasImported = posts.find(e => e.createdBy === importer);

    if (hasImported) {
      throw new HttpErrors.UnprocessableEntity(
        'You have already import this post',
      );
    }

    if (posts.length === 0) return undefined;

    const platformUser = _.omit(posts[0].people, ['id']);
    const existingPost = _.omit(posts[0], [
      'id',
      'people',
      'metric',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ]);

    return _.assign(existingPost as ExtendedPost, {platformUser: platformUser});
  }

  async restrictedPost(post: Post): Promise<Post> {
    const creator = post.createdBy;
    const visibility = post.visibility;
    switch (visibility) {
      case VisibilityType.FRIEND: {
        if (this.currentUser[securityId] === creator) return post;
        const friend = await this.friendRepository.findOne({
          where: {
            requestorId: this.currentUser[securityId],
            requesteeId: creator,
          },
        });

        if (!friend) throw new HttpErrors.Forbidden('Restricted post!');
        if (friend.status === FriendStatusType.APPROVED) return post;
        throw new HttpErrors.Forbidden('Restricted post!');
      }

      case VisibilityType.PRIVATE: {
        if (this.currentUser[securityId] === creator) return post;
        throw new HttpErrors.Forbidden('Restricted post!');
      }

      default:
        return post;
    }
  }
}
