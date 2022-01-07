import {AnyObject, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {ExtendedPost} from '../interfaces';
import {DraftPost, PostWithRelations, User} from '../models';
import {
  PeopleRepository,
  PostRepository,
  CommentRepository,
  FriendRepository,
  VoteRepository,
  DraftPostRepository,
} from '../repositories';
import {injectable, BindingScope, service} from '@loopback/core';
import {BcryptHasher} from './authentication/hash.password.service';
import {config} from '../config';
import {PlatformType, ReferenceType} from '../enums';
import {MetricService} from '../services';
import {UrlUtils} from '../utils/url.utils';

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
    await this.metricService.postMetric(ReferenceType.POST, id);
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
}
