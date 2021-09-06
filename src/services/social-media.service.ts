import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {PlatformType} from '../enums';
import {ExtendedPeople, ExtendedPost} from '../interfaces';
import {Asset} from '../interfaces/asset.interface';
import {People} from '../models';
import {PeopleRepository} from '../repositories';
import {Facebook, Reddit, Twitter} from '../services';
import {UrlUtils} from '../utils/url.utils';

const {getOpenGraph} = new UrlUtils();

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

  async verifyToTwitter(username: string, publicKey: string): Promise<ExtendedPeople> {
    const {data: user} = await this.twitterService.getActions(
      `2/users/by/username/${username}?user.fields=profile_image_url`,
    );
    if (!user) throw new HttpErrors.NotFound('Invalid username');

    // Fetch post timeline based on twitter userId from twitter api
    const {data: tweets} = await this.twitterService.getActions(
      `2/users/${user.id}/tweets?max_results=5`,
    );

    if (!tweets) throw new HttpErrors.NotFound('Tweet not found/protected by user');

    // Verify that the publicKey is existing in user twitter
    const foundTwitterPublicKey = tweets[0].text
      .split(' ')
      .find((tweet: string) => tweet === publicKey);

    if (!foundTwitterPublicKey) throw new HttpErrors.NotFound('Cannot find specified post');

    this.fetchTwitterFollowing(user.id) as Promise<void>;

    return {
      name: user.name,
      originUserId: user.id,
      platform: PlatformType.TWITTER,
      username: user.username,
      profilePictureURL: user.profile_image_url || '',
      publicKey: publicKey,
    } as ExtendedPeople;
  }

  async verifyToReddit(username: string, publicKey: string): Promise<ExtendedPeople> {
    // Fetch data user from reddit api
    const {data: redditUser} = await this.redditService.getActions(`user/${username}/about.json`);

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

    if (!foundRedditPublicKey) throw new HttpErrors.NotFound('Cannot find specified post');

    return {
      name: redditUser.subreddit.title ? redditUser.subreddit.title : redditUser.name,
      originUserId: 't2_' + redditUser.id,
      platform: PlatformType.REDDIT,
      username: redditUser.name,
      profilePictureURL: redditUser.icon_img ? redditUser.icon_img.split('?')[0] : '',
      publicKey: publicKey,
    } as ExtendedPeople;
  }

  async verifyToFacebook(username: string, publicKey: string): Promise<ExtendedPeople> {
    const splitUsername = username.split('/');
    const fbUsername = splitUsername[3];
    const fbPostId = splitUsername[5];

    const fbPost = await this.fetchFacebookPost(fbUsername, fbPostId, publicKey);

    if (!fbPost.platformUser) throw new Error('Platform user not exist!');

    const {username: userName, name, originUserId, profilePictureURL} = fbPost.platformUser;

    return {
      name,
      username: userName,
      originUserId,
      platform: PlatformType.FACEBOOK,
      profilePictureURL,
      publicKey: publicKey,
    } as ExtendedPeople;
  }

  async fetchTwitterFollowing(platformAccountId: string): Promise<void> {
    if (!platformAccountId) return;

    const {data: following} = await this.twitterService.getActions(
      `2/users/${platformAccountId}/following?user.fields=profile_image_url`,
    );

    for (const person of following) {
      const foundPerson = await this.peopleRepository.findOne({
        where: {
          originUserId: person.id,
        },
      });

      if (!foundPerson) {
        this.peopleRepository.create({
          name: person.name,
          username: person.username,
          originUserId: person.id,
          platform: PlatformType.TWITTER,
          profilePictureURL: person.profile_image_url || '',
        }) as Promise<People>;
      }
    }
  }

  async fetchTweet(textId: string): Promise<ExtendedPost> {
    let data = null;

    try {
      data = await this.twitterService.getActions(
        `1.1/statuses/show.json?id=${textId}&include_entities=true&tweet_mode=extended`,
      );
    } catch {
      throw new HttpErrors.UnprocessableEntity('Tweet not found/protected by user');
    }

    const {
      id_str: idStr,
      full_text: fullText,
      created_at: createdAt,
      user,
      entities,
      extended_entities: extendedEntities,
    } = data;

    const asset: Asset = {
      images: [],
      videos: [],
    };

    /* eslint-disable  @typescript-eslint/no-explicit-any */
    const twitterTags = entities
      ? entities.hashtags
        ? entities.hashtags.map((hashtag: any) => hashtag.text)
        : []
      : [];

    if (extendedEntities) {
      const medias = extendedEntities.media;

      for (const media of medias) {
        if (media.type === 'photo') {
          asset.images.push(media.media_url_https);
        } else {
          const videoInfo = media.video_info.variants;

          for (const video of videoInfo) {
            if (video.content_type === 'video/mp4') {
              asset.videos.push(video.url.split('?tag=12')[0]);
              break;
            }
          }
        }
      }
    }

    const urls = entities.urls.map((url: any) => url.expanded_url);

    let embedded = null;

    if (urls.length > 0) {
      try {
        embedded = await getOpenGraph(urls[0]);
      } catch {
        // ignore
      }
    }

    const findUrlInFullText = fullText.search('https://t.co/');
    const text = fullText
      .substring(0, findUrlInFullText !== -1 ? findUrlInFullText : fullText.length)
      .trim();

    return {
      platform: PlatformType.TWITTER,
      originPostId: idStr,
      text: text.trim(),
      tags: twitterTags,
      originCreatedAt: new Date(createdAt).toString(),
      asset: asset,
      embeddedURL: embedded,
      url: `https://twitter.com/${user.id_str}/status/${textId}`,
      platformUser: {
        name: user.name,
        username: user.screen_name,
        originUserId: user.id_str,
        profilePictureURL: user.profile_image_url_https || '',
        platform: PlatformType.TWITTER,
      },
    } as ExtendedPost;
  }

  async fetchRedditPost(textId: string): Promise<ExtendedPost> {
    let data = null;

    try {
      [data] = await this.redditService.getActions(textId + '.json');
    } catch {
      throw new HttpErrors.UnprocessableEntity('Post not found');
    }

    const redditPost = data.data.children[0].data;
    const asset: Asset = {
      images: [],
      videos: [],
    };

    let url = redditPost.url_overridden_by_dest ?? '';
    let text = redditPost.selftext;

    const found = text.match(/https:\/\/|http:\/\/|www./g);
    if (found) {
      const index: number = (text as string).indexOf('](' + found[0]);

      url = '';

      for (let i = index + 2; i < text.length; i++) {
        const letter = text[i];

        if (letter === ')') break;
        url += letter;
      }

      text = text.substring(0, text.indexOf('[' + found[0]));
    }

    if (redditPost.post_hint === 'image') {
      asset.images.push(redditPost.url);
      url = '';
    }

    if (redditPost.is_video) {
      asset.videos.push(redditPost.media.reddit_video.fallback_url);
      url = '';
    }

    if (redditPost.media_metadata) {
      for (const img in redditPost.media_metadata) {
        if (redditPost.media_metadata[img].e === 'Image') {
          asset.images.push(redditPost.media_metadata[img].s.u.replace(/amp;/g, ''));
        }

        if (redditPost.media_metadata[img].e === 'RedditVideo') {
          asset.videos.push(
            `https://reddit.com/link/${textId}/video/${redditPost.media_metadata[img].id}/player`,
          );
        }
      }
    }

    let embedded = null;

    if (url) {
      const imageFormat = /[.]jpg$|[.]jpeg$|[.]png$|[.]gif$|[.]tiff$/;
      const image = url.match(imageFormat);

      if (image) {
        asset.images.push(url);
        url = '';
      } else {
        try {
          embedded = await getOpenGraph(url);
        } catch {
          // ignore
        }
      }
    }

    const redditUser = redditPost.author;

    let user = null;

    try {
      ({data: user} = await this.redditService.getActions('user/' + redditUser + '/about.json'));
    } catch {
      throw new HttpErrors.UnprocessableEntity('User not found');
    }

    return {
      platform: PlatformType.REDDIT,
      originPostId: textId,
      originCreatedAt: new Date(redditPost.created_utc * 1000).toString(),
      title: redditPost.title,
      text: text.trim(),
      url: `https://reddit.com/${textId}`,
      asset: asset,
      embeddedURL: embedded,
      platformUser: {
        name: user.subreddit.title ? user.subreddit.title : user.name,
        username: user.name,
        originUserId: 't2_' + user.id,
        profilePictureURL: user.icon_img.split('?')[0],
        platform: PlatformType.REDDIT,
      },
    } as ExtendedPost;
  }

  async fetchFacebookPost(
    username: string,
    textId: string,
    publicKey?: string,
  ): Promise<ExtendedPost> {
    let platformAccountId = '';
    let profileImageUrl = '';

    const data = await this.facebookService.getActions(username, textId);

    if (publicKey) {
      const foundIndex = data.search(publicKey);
      const getPublicKey = data.substring(foundIndex, foundIndex + 66);

      if (foundIndex === -1) throw new HttpErrors.NotFound('Cannot find specified post');
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
    const entityIndex = post.substring(findEntityIdIndex + '"entity_id"'.length + 2);

    for (const char of entityIndex) {
      if (char === '"') break;

      platformAccountId += char;
    }

    // Get profile image url
    const findIndex = post.search(`"identifier":${platformAccountId}`);
    const getString = post.substring(findIndex);
    const findImageIndex = getString.search('"image"');
    const getImageString = getString.substring(findImageIndex + '"image"'.length + 2);

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
    const getUrl = post.substring(findIndex + `"identifier":${platformAccountId},"url":"`.length);

    let url = '';

    for (let i = 0; getUrl.length; i++) {
      if (getUrl[i] === '"') break;
      url += getUrl[i];
    }

    const name = arrayName.join('');
    const userName = url.replace(/\\/g, '').split('/')[3];

    if (!name || !userName) {
      throw new HttpErrors.UnprocessableEntity('Cannot find the specified post');
    }

    return {
      platform: PlatformType.FACEBOOK,
      textId: textId,
      originCreatedAt: platformCreatedAt,
      url: `https://facebook.com/${username}/posts/${textId}`,
      platformUser: {
        name: arrayName.join(''),
        username: userName,
        originUserId: platformAccountId,
        profilePictureURL: profileImageUrl.split('\\').join(''),
        platform: PlatformType.FACEBOOK,
      },
    } as unknown as ExtendedPost;
  }
}
