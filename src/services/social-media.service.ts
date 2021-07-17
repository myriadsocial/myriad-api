import {ExtendedUser} from '../interfaces';
import {HttpErrors} from '@loopback/rest';
import {inject} from '@loopback/core';
import {Facebook, Reddit, Twitter} from '../services';
import {repository} from '@loopback/repository';
import {PeopleRepository} from '../repositories';
import {PlatformType} from '../enums';
import {People, Post} from '../models';

export class SocialMediaService {
  constructor(
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @inject('services.Twitter')
    protected twitterService: Twitter,
    @inject('services.Reddit')
    protected redditService: Reddit,
    @inject('services.Facebook')
    protected facebookService: Facebook,
  ) {}

  async verifyToTwitter(
    username: string,
    publicKey: string,
  ): Promise<ExtendedUser> {
    const {data: user} = await this.twitterService.getActions(
      `2/users/by/username/${username}?user.fields=profile_image_url`,
    );
    if (!user) throw new HttpErrors.NotFound('Invalid username');

    // Fetch post timeline based on twitter userId from twitter api
    const {data: tweets} = await this.twitterService.getActions(
      `2/users/${user.id}/tweets?max_results=5`,
    );

    // Verify that the publicKey is existing in user twitter
    const foundTwitterPublicKey = tweets[0].text
      .split(' ')
      .find((tweet: string) => tweet === publicKey);

    if (!foundTwitterPublicKey)
      throw new HttpErrors.NotFound('Cannot find specified post');

    return {
      name: user.name,
      platformAccountId: user.id,
      platform: PlatformType.TWITTER, // TODO: move to single constant enum platform
      username: user.username,
      profileImageURL: user.profile_image_url
        ? user.profile_image_url.replace('normal', '400x400')
        : '',
      publicKey: publicKey,
    };
  }

  async verifyToReddit(
    username: string,
    publicKey: string,
  ): Promise<ExtendedUser> {
    // Fetch data user from reddit api
    const {data: redditUser} = await this.redditService.getActions(
      `user/${username}/about.json`,
    );

    // Fetch post timeline based on reddit username from reddit api
    const {data: foundRedditPost} = await this.redditService.getActions(
      `user/${username}/.json?limit=1`,
    );

    if (foundRedditPost.children.length === 0)
      throw new HttpErrors.NotFound('Cannot find the spesified post');

    // Verify that the publicKey is existing in user reddit
    const foundRedditPublicKey = foundRedditPost.children[0].data.title
      .split(' ')
      .find((post: string) => post === publicKey);

    if (!foundRedditPublicKey)
      throw new HttpErrors.NotFound('Cannot find specified post');

    return {
      name: redditUser.subreddit.title
        ? redditUser.subreddit.title
        : redditUser.name,
      platformAccountId: 't2_' + redditUser.id,
      platform: PlatformType.REDDIT, // TODO: move to single constant enum platform
      username: redditUser.name,
      profileImageURL: redditUser.icon_img
        ? redditUser.icon_img.split('?')[0]
        : '',
      publicKey: publicKey,
    };
  }

  async verifyToFacebook(
    username: string,
    publicKey: string,
  ): Promise<ExtendedUser> {
    const splitUsername = username.split('/');
    const fbUsername = splitUsername[3];
    const fbPostId = splitUsername[5];

    const fbPost = await this.fetchFacebookPost(
      fbUsername,
      fbPostId,
      publicKey,
    );

    if (!fbPost.platformUser) throw new Error('Platform user not exist!');

    const {
      username: userName,
      name,
      platformAccountId,
      profileImageURL,
    } = fbPost.platformUser;

    return {
      name,
      username: userName,
      platformAccountId,
      platform: PlatformType.FACEBOOK, // TODO: move to single constant enum platform
      profileImageURL,
      publicKey: publicKey,
    };
  }

  async fetchTwitterFollowing(platformAccountId: string): Promise<void> {
    if (!platformAccountId) return;

    const {data: following} = await this.twitterService.getActions(
      `2/users/${platformAccountId}/following?user.fields=profile_image_url`,
    );

    for (const person of following) {
      const foundPerson = await this.peopleRepository.findOne({
        where: {
          platformAccountId: person.id,
        },
      });

      if (!foundPerson) {
        this.peopleRepository.create({
          name: person.name,
          username: person.username,
          platformAccountId: person.id,
          platform: PlatformType.TWITTER, // TODO: move to single constant enum platform
          profileImageURL: person.profile_image_url.replace(
            'normal',
            '400x400',
          ),
          hide: false,
        }) as Promise<People>;
      }
    }
  }

  async fetchTweet(textId: string): Promise<Post> {
    const {
      id_str: idStr,
      full_text: fullText,
      created_at: createdAt,
      user,
      entities,
      extended_entities: extendedEntities,
    } = await this.twitterService.getActions(
      `1.1/statuses/show.json?id=${textId}&include_entities=true&tweet_mode=extended`,
    );

    if (!idStr)
      throw new HttpErrors.NotFound('Cannot found the specified url!');

    const assets: string[] = [];
    let hasMedia = true;

    /* eslint-disable  @typescript-eslint/no-explicit-any */
    const twitterTags = entities
      ? entities.hashtags
        ? entities.hashtags.map((hashtag: any) => hashtag.text)
        : []
      : [];

    if (!extendedEntities) hasMedia = false;
    else {
      const medias = extendedEntities.media;

      for (const media of medias) {
        if (media.type === 'photo') {
          assets.push(media.media_url_https);
        } else {
          const videoInfo = media.video_info.variants;

          for (const video of videoInfo) {
            if (video.content_type === 'video/mp4') {
              assets.push(video.url.split('?tag=12')[0]);
              break;
            }
          }
        }
      }
    }

    const urls = entities.urls.map((url: any) => url.expanded_url);

    const findUrlInFullText = fullText.search('https://t.co/');
    const text = fullText
      .substring(
        0,
        findUrlInFullText !== -1 ? findUrlInFullText : fullText.length,
      )
      .trim();

    return {
      platform: PlatformType.TWITTER, // TODO: move to single constant enum platform
      createdAt: new Date().toString(),
      textId: idStr,
      text: (text + ' ' + urls.join(' ')).trim(),
      tags: twitterTags,
      platformCreatedAt: new Date(createdAt).toString(),
      assets: assets,
      link: `https://twitter.com/${user.id_str}/status/${textId}`,
      hasMedia: hasMedia,
      platformUser: {
        name: user.name,
        username: user.screen_name,
        platformAccountId: user.id_str,
        profileImageURL: user.profile_image_url_https.replace(
          'normal',
          '400x400',
        ),
      },
    } as Post;
  }

  async fetchRedditPost(textId: string): Promise<Post> {
    const [data] = await this.redditService.getActions(textId + '.json');
    const redditPost = data.data.children[0].data;
    const assets: string[] = [];

    let url = redditPost.url_overridden_by_dest
      ? redditPost.url_overridden_by_dest
      : '';
    let hasMedia = false;

    if (redditPost.post_hint === 'image') {
      assets.push(redditPost.url);
      hasMedia = true;
      url = '';
    }

    if (redditPost.is_video) {
      assets.push(redditPost.media.reddit_video.fallback_url);
      hasMedia = true;
      url = '';
    }

    if (redditPost.media_metadata) {
      for (const img in redditPost.media_metadata) {
        if (redditPost.media_metadata[img].e === 'Image') {
          assets.push(redditPost.media_metadata[img].s.u.replace(/amp;/g, ''));
        }

        if (redditPost.media_metadata[img].e === 'RedditVideo') {
          assets.push(
            `https://reddit.com/link/${textId}/video/${redditPost.media_metadata[img].id}/player`,
          );
        }
      }

      hasMedia = true;
    }

    const redditUser = redditPost.author;
    const {data: user} = await this.redditService.getActions(
      'user/' + redditUser + '/about.json',
    );

    return {
      platform: PlatformType.REDDIT, // TODO: move to single constant enum platform,
      createdAt: new Date().toString(),
      textId: textId,
      platformCreatedAt: new Date(redditPost.created_utc * 1000).toString(),
      title: redditPost.title,
      text: (redditPost.selftext + ' ' + url).trim(),
      link: `https://reddit.com/${textId}`,
      hasMedia: hasMedia,
      assets,
      platformUser: {
        name: user.subreddit.title ? user.subreddit.title : user.name,
        username: user.name,
        platformAccountId: 't2_' + user.id,
        profileImageURL: user.icon_img.split('?')[0],
      },
    } as Post;
  }

  async fetchFacebookPost(
    username: string,
    textId: string,
    publicKey?: string,
  ): Promise<Post> {
    let platformAccountId = '';
    let profileImageUrl = '';

    const data = await this.facebookService.getActions(username, textId);

    if (publicKey) {
      const foundIndex = data.search(publicKey);
      const getPublicKey = data.substring(foundIndex, foundIndex + 66);

      if (foundIndex === -1)
        throw new HttpErrors.NotFound('Cannot find specified post');
      if (getPublicKey.replace('"', '').trim() !== publicKey)
        throw new HttpErrors.NotFound('Cannot find specified post');
    }

    const findSocialMedialPostingIndex = data.search('"SocialMediaPosting"');
    const post = data.substring(findSocialMedialPostingIndex);

    // Get platform created at
    const findDateCreatedIndex = post.search('"dateCreated"');
    const findDateModifiedIndex = post.search('"dateModified"');
    const platformCreatedAt = post.substring(
      findDateCreatedIndex + '"dateCreated"'.length + 2,
      findDateModifiedIndex - 2,
    );

    // Get platform account id
    const findEntityIdIndex = post.search('"entity_id"');
    const entityIndex = post.substring(
      findEntityIdIndex + '"entity_id"'.length + 2,
    );

    for (const char of entityIndex) {
      if (char === '"') break;

      platformAccountId += char;
    }

    // Get profile image url
    const findIndex = post.search(`"identifier":${platformAccountId}`);
    const getString = post.substring(findIndex);
    const findImageIndex = getString.search('"image"');
    const getImageString = getString.substring(
      findImageIndex + '"image"'.length + 2,
    );

    for (const char of getImageString) {
      if (char === '"') break;
      profileImageUrl += char;
    }

    // Get name
    const arrayName = [];

    for (let i = findIndex - 1; i > 0; i--) {
      if (post[i] === ':') break;
      if (post[i] === '"' || post[i] === ',') continue;

      arrayName.unshift(post[i]);
    }

    // Get username
    const getUrl = post.substring(
      findIndex + `"identifier":${platformAccountId},"url":"`.length,
    );

    let url = '';

    for (let i = 0; getUrl.length; i++) {
      if (getUrl[i] === '"') break;
      url += getUrl[i];
    }

    const name = arrayName.join('');
    const userName = url.replace(/\\/g, '').split('/')[3];

    if (!name || !userName) {
      throw new HttpErrors.UnprocessableEntity(
        'Cannot find the specified post',
      );
    }

    return {
      platform: PlatformType.FACEBOOK,
      createdAt: new Date().toString(),
      textId: textId,
      platformCreatedAt: platformCreatedAt,
      link: `https://facebook.com/${username}/posts/${textId}`,
      platformUser: {
        name: arrayName.join(''),
        username: userName,
        platformAccountId: platformAccountId,
        profileImageURL: profileImageUrl.split('\\').join(''),
      },
      assets: [],
    } as unknown as Post;
  }
}
