import {repository} from '@loopback/repository';
import {MigrationScript, migrationScript} from 'loopback4-migration';
import {
  PeopleRepository,
  PostRepository,
} from '../repositories';
import {People, Post} from '../models';
import {PlatformType} from '../enums';
import {inject} from '@loopback/core';
import {Twitter, Reddit} from '../services';
import {BcryptHasher} from '../services/authentication/hash.password.service';
import {config} from '../config';
import {PolkadotJs} from '../utils/polkadotJs-utils';

@migrationScript()
export class MigrationScript100 implements MigrationScript {
  version = '1.0.0';

  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @inject('services.Twitter')
    protected twitterService: Twitter,
    @inject('services.Reddit')
    protected redditService: Reddit,
  ) {}

  async up(): Promise<void> {
    await this.doMigratePosts();
    await this.doMigratePeople();
  }

  async doMigratePosts(): Promise<void> {
    const posts = await this.postRepository.find();

    await Promise.all(
      posts.map(async (post: Partial<Post>) => {
        const originPostId = post.originPostId;
        const platform = post.platform;

        if (post.importers && post.importers.length > 0) {
          const importers = post.importers.map(importer =>
            JSON.stringify(importer),
          );
          const postId = post.id ?? '';

          delete post.id;
          delete post.importers;

          await Promise.all(
            importers.map(async (importer: string) => {
              if (importer === post.createdBy) return null;

              post.createdBy = importer;

              const found = await this.postRepository.findOne({
                where: {
                  originPostId: post.originPostId,
                  platform: post.platform,
                  createdBy: post.createdBy,
                },
              });

              if (found) return null;

              return this.postRepository.create(post);
            }),
          );

          return this.postRepository.updateById(postId, {importers: []});
        }

        const {count} = await this.postRepository.count({
          originPostId,
          platform,
        });

        await this.postRepository.updateAll(
          {totalImporter: count},
          {originPostId: originPostId, platform: platform},
        );

        return null;
      }),
    );

    await this.postRepository.updateAll({importers: []});
  }

  async doMigratePeople(): Promise<void> {
    const posts = await this.postRepository.find({
      where: {
        or: [
          {
            platform: PlatformType.TWITTER,
          },
          {
            platform: PlatformType.REDDIT,
          },
        ],
      },
      include: ['people'],
    });

    for (const post of posts) {
      if (post.people) continue;

      const originPostId = post.originPostId;
      const platform = post.platform;

      let newPeople = null;

      switch (platform) {
        case PlatformType.REDDIT: {
          newPeople = await this.fetchRedditPost(originPostId ?? '');
          break;
        }

        case PlatformType.TWITTER: {
          newPeople = await this.fetchTweet(originPostId ?? '');
          break;
        }

        default:
          continue;
      }

      if (!newPeople) continue;

      const createdPeople = await this.createOrFindPeople(newPeople);

      await this.postRepository.updateById(post.id, {
        peopleId: createdPeople.id,
      });
    }
  }

  async fetchTweet(originPostId: string): Promise<People | null> {
    if (!originPostId) return null;

    let data = null;

    try {
      data = await this.twitterService.getActions(
        `1.1/statuses/show.json?id=${originPostId}&include_entities=true&tweet_mode=extended`,
      );
    } catch {
      // ignore
    }

    if (!data) return null;

    const {user} = data;

    return new People({
      name: user.name,
      username: user.screen_name,
      originUserId: user.id_str,
      profilePictureURL: user.profile_image_url_https || '',
      platform: PlatformType.TWITTER,
    });
  }

  async fetchRedditPost(originPostId: string): Promise<People | null> {
    if (!originPostId) return null;

    let data = null;

    try {
      [data] = await this.redditService.getActions(originPostId + '.json');
    } catch {
      // ignore
    }

    if (!data) return null;

    const redditPost = data.data.children[0].data;
    const redditUser = redditPost.author;

    let user = null;

    try {
      ({data: user} = await this.redditService.getActions(
        'user/' + redditUser + '/about.json',
      ));
    } catch {
      // ignore
    }

    if (!user) return null;

    return new People({
      name: user.subreddit
        ? user.subreddit.title
          ? user.subreddit.title
          : user.name
        : user.name,
      username: user.name,
      originUserId: 't2_' + user.id,
      profilePictureURL: user.icon_img ? user.icon_img.split('?')[0] : '',
      platform: PlatformType.REDDIT,
    });
  }

  async createOrFindPeople(people: People): Promise<People> {
    const {getKeyring, getHexPublicKey} = new PolkadotJs();

    let newPeople = await this.peopleRepository.findOne({
      where: {
        originUserId: people.originUserId,
        platform: people.platform,
      },
    });

    if (!newPeople) {
      newPeople = await this.peopleRepository.create(people);

      const hasher = new BcryptHasher();
      const hashPeopleId = await hasher.hashPassword(
        newPeople.id + config.ESCROW_SECRET_KEY,
      );
      const newKey = getKeyring().addFromUri('//' + hashPeopleId);

      await this.peopleRepository.updateById(newPeople.id, {
        walletAddress: getHexPublicKey(newKey),
      });
    }

    return newPeople;
  }
}
