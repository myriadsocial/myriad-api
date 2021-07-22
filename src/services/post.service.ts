import {repository} from '@loopback/repository';
import {
  PeopleRepository,
  PostRepository,
  PostTipRepository,
} from '../repositories';
import {HttpErrors} from '@loopback/rest';
import {DetailUrl} from '../interfaces';
import {Post, PostTip, PublicMetric} from '../models';
import {service} from '@loopback/core';
import {SocialMediaService} from './social-media.service';
import {TagService} from './tag.service';
import {KeypairType} from '@polkadot/util-crypto/types';
import {u8aToHex} from '@polkadot/util';
import {Keyring} from '@polkadot/api';
import {DefaultCrypto, PlatformType} from '../enums';

export class PostService {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(PostTipRepository)
    protected postTipRepository: PostTipRepository,
    @service(SocialMediaService)
    protected socialMediaService: SocialMediaService,
    @service(TagService)
    protected tagService: TagService,
  ) {}

  async getPostFromSocialMediaPost(detailUrl: DetailUrl): Promise<Post> {
    const {textId, platform, postTags, importer, username} = detailUrl;
    const foundPost = await this.postRepository.findOne({
      where: {textId, platform},
    });

    if (foundPost) {
      const foundImporter = foundPost.importBy.find(
        (userId: string) => userId === importer,
      );

      if (foundImporter) {
        throw new HttpErrors.UnprocessableEntity(
          'You have already import this post',
        );
      }

      foundPost.importBy.push(importer);

      this.postRepository.updateById(foundPost.id, {
        importBy: foundPost.importBy,
      }) as Promise<void>;

      return foundPost;
    }

    let newPost: Omit<Post, 'id'>;
    let tags: string[] = postTags;

    switch (platform) {
      case PlatformType.TWITTER: {
        newPost = await this.socialMediaService.fetchTweet(textId);
        tags = !newPost.tags
          ? []
          : newPost.tags.filter((tag: string) => {
              return !postTags
                .map((postTag: string) => postTag.toLowerCase())
                .includes(tag.toLowerCase());
            });
        tags = [...tags, ...postTags];

        break;
      }

      case PlatformType.REDDIT: {
        newPost = await this.socialMediaService.fetchRedditPost(
          textId,
        );

        break;
      }

      case PlatformType.FACEBOOK: {
        if (!username) {
          throw new HttpErrors.UnprocessableEntity('Username not found!');
        }

        newPost = await this.socialMediaService.fetchFacebookPost(
          username,
          textId,
        );

        break;
      }

      default:
        throw new HttpErrors.NotFound('Cannot found the specified url!');
    }

    newPost.tags = tags;
    newPost.importBy = [importer];
    newPost.importerId = importer;

    this.tagService.createTags(newPost.tags) as Promise<void>;

    return this.createPost(newPost);
  }

  async createPost(post: Omit<Post, 'id'>): Promise<Post> {
    const {platformUser, platform} = post;

    let foundPeople = await this.peopleRepository.findOne({
      where: {
        platformAccountId: platformUser?.platformAccountId,
        platform: platform,
      },
    });

    if (!foundPeople) {
      foundPeople = await this.peopleRepository.create({
        ...platformUser,
        platform,
      });
    }

    return this.createPostWithPublicMetric({
      ...post,
      peopleId: foundPeople.id,
    });
  }

  async createPostWithPublicMetric(post: Omit<Post, 'id'>): Promise<Post> {
    const keyring = new Keyring({
      type: process.env.MYRIAD_CRYPTO_TYPE as KeypairType,
    });
    const newKey = keyring.addFromUri('//' + post.peopleId);

    post.walletAddress = u8aToHex(newKey.publicKey);

    const createdPost = await this.postRepository.create(post);

    this.postRepository
      .publicMetric(createdPost.id)
      .create({}) as Promise<PublicMetric>;

    this.postRepository
      .postTips(createdPost.id)
      .create({cryptocurrencyId: DefaultCrypto.AUSD}) as Promise<PostTip>;

    return createdPost;
  }
}
