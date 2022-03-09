import {inject} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {PlatformType} from '../enums';
import {ExtendedPost} from '../interfaces';
import {Asset} from '../interfaces/asset.interface';
import {PeopleRepository} from '../repositories';
import {Facebook, Reddit, Twitter} from '../services';
import {UrlUtils} from '../utils/url.utils';
import {injectable, BindingScope} from '@loopback/core';
import {formatRawText} from '../utils/format-tag';
import {EmbeddedURL, Media} from '../models';
import {People} from '../models';

const urlUtils = new UrlUtils();
const {validateURL, getOpenGraph} = urlUtils;

@injectable({scope: BindingScope.TRANSIENT})
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

  async verifyToTwitter(username: string, publicKey: string): Promise<People> {
    let user = null;
    let tweets = null;

    try {
      ({data: user} = await this.twitterService.getActions(
        `2/users/by/username/${username}?user.fields=profile_image_url`,
      ));

      // Fetch post timeline based on twitter userId from twitter api
      ({data: tweets} = await this.twitterService.getActions(
        `2/users/${user.id}/tweets?max_results=5`,
      ));
    } catch {
      // ignore
    }

    if (!user) throw new HttpErrors.NotFound('Invalid username');
    if (!tweets)
      throw new HttpErrors.NotFound('Tweet not found/protected by user');

    // Verify that the publicKey is existing in user twitter
    const foundTwitterPublicKey = tweets[0]?.text
      .replace(/\n/g, ' ')
      .split(' ')
      .find((tweet: string) => tweet === publicKey);

    if (!foundTwitterPublicKey)
      throw new HttpErrors.NotFound('Cannot find specified post');

    // await this.fetchTwitterFollowing(user.id);

    return new People({
      name: user.name,
      originUserId: user.id,
      platform: PlatformType.TWITTER,
      username: user.username,
      profilePictureURL: user.profile_image_url || '',
    });
  }

  async verifyToReddit(username: string, publicKey: string): Promise<People> {
    try {
      const {data: redditUser} = await this.redditService.getActions(
        `user/${username}/about.json`,
      );
      const {data: redditPost} = await this.redditService.getActions(
        `user/${username}/.json?limit=1`,
      );

      const found = redditPost?.children[0]?.data?.title
        .replace(/\n/g, ' ')
        .split(' ')
        .find((post: string) => post === publicKey);

      if (!found) throw new Error('PostNotFound');

      return new People({
        name: redditUser.subreddit.title
          ? redditUser.subreddit.title
          : redditUser.name,
        originUserId: 't2_' + redditUser.id,
        platform: PlatformType.REDDIT,
        username: redditUser.name,
        profilePictureURL: redditUser.icon_img
          ? redditUser.icon_img.split('?')[0]
          : '',
      });
    } catch {
      throw new HttpErrors.NotFound('Cannot find the specified post');
    }
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
        await this.peopleRepository.create({
          name: person.name,
          username: person.username,
          originUserId: person.id,
          platform: PlatformType.TWITTER,
          profilePictureURL: person.profile_image_url || '',
        });
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
      throw new HttpErrors.UnprocessableEntity(
        'Tweet not found/protected by user',
      );
    }

    const {
      id_str: idStr,
      full_text: fullText,
      created_at: createdAt,
      user,
      entities,
      extended_entities: extendedEntities,
      quoted_status: quotedStatus,
      display_text_range: [startWith],
    } = data;

    const asset: Asset = {
      images: [],
      videos: [],
    };

    const twitterTags = entities
      ? entities.hashtags
        ? entities.hashtags.map((hashtag: AnyObject) =>
            hashtag.text.toLowerCase(),
          )
        : []
      : [];

    let text: String = fullText.substring(startWith);
    if (extendedEntities) {
      const medias = extendedEntities.media;

      for (const media of medias) {
        text = text.replace(media.url, '');

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

    for (const entity of entities.urls as AnyObject[]) {
      const url = entity.url;
      const expandedURL = entity.expanded_url;

      text = text.replace(url, expandedURL);
    }

    let embedded = null;
    let embeddedURL = entities?.urls[entities.urls.length - 1]?.expanded_url;

    if (embeddedURL && asset.images.length === 0 && asset.videos.length === 0) {
      try {
        validateURL(embeddedURL);
        if (quotedStatus) {
          const [embeddeStartWith] = quotedStatus?.display_text_range ?? 0;
          const quoteEntities = quotedStatus?.entities?.urls ?? [];

          let description =
            quotedStatus?.full_text?.substring(embeddeStartWith) ?? '';

          quoteEntities.forEach((entity: AnyObject) => {
            description = description.replace(
              entity?.url ?? '',
              entity?.expanded_url ?? '',
            );
          });

          const defaultImage =
            'https://res.cloudinary.com/hakimblocksphere/image/upload/v1645684958/4719129_vgwiii.webp';

          embeddedURL =
            quotedStatus?.user?.screen_name && quotedStatus?.id_str
              ? `https://twitter.com/${quotedStatus.user.screen_name}/status/${quotedStatus.id_str}`
              : '';

          embedded = new EmbeddedURL({
            title: quotedStatus?.user?.name ?? '',
            description: description,
            siteName: 'Twitter',
            url: embeddedURL,
            image: new Media({
              url: quotedStatus?.user?.profile_banner_url ?? defaultImage,
            }),
          });
        } else {
          embedded = await getOpenGraph(embeddedURL);
        }

        if (embedded) {
          text = text.replace(embeddedURL, '');
        }
      } catch {
        // ignore
      }
    }

    return {
      platform: PlatformType.TWITTER,
      originPostId: idStr,
      text: text.trim(),
      rawText: formatRawText(text),
      tags: twitterTags.filter((tag: string) => Boolean(tag)),
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
    const text = redditPost.selftext;
    const asset: Asset = {
      images: [],
      videos: [],
    };

    let url = redditPost.url_overridden_by_dest ?? '';

    const found = text.match(/https:\/\/|http:\/\/|www./g);
    if (found) {
      const index: number = (text as string).indexOf('](' + found[0]);

      url = '';

      for (let i = index + 2; i < text.length; i++) {
        const letter = text[i];

        if (letter === ')') break;
        url += letter;
      }
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
          asset.images.push(
            redditPost.media_metadata[img].s.u.replace(/amp;/g, ''),
          );
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
          validateURL(url);
          embedded = await getOpenGraph(url);
        } catch {
          // ignore
        }
      }
    }

    const redditUser = redditPost.author;

    let user = null;

    try {
      ({data: user} = await this.redditService.getActions(
        'user/' + redditUser + '/about.json',
      ));
    } catch {
      throw new HttpErrors.UnprocessableEntity('User not found');
    }

    const redditText = text.replace(/&(amp;)*#x200B;*/, '').trim();
    const redditRawText = redditText
      .replace(/\n/gi, ' ')
      .replace(/ +/gi, ' ')
      .trim();
    const rawText = redditPost.title + ' ' + redditRawText;

    return {
      platform: PlatformType.REDDIT,
      originPostId: textId,
      originCreatedAt: new Date(redditPost.created_utc * 1000).toString(),
      title: redditPost.title,
      text: redditText.trim(),
      rawText: rawText.trim(),
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
}
