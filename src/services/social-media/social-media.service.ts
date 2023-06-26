import {BindingScope, inject, injectable} from '@loopback/core';
import {AnyObject} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {PlatformType} from '../../enums';
import {Asset, Sizes} from '../../interfaces';
import {EmbeddedURL, ExtendedPost, Media, People} from '../../models';
import {Reddit, Twitter} from '..';
import {formatRawText} from '../../utils/formatter';
import {UrlUtils} from '../../utils/url-utils';

const {validateURL, getOpenGraph} = UrlUtils;

@injectable({scope: BindingScope.TRANSIENT})
export class SocialMediaService {
  constructor(
    @inject('services.Twitter')
    private twitterService: Twitter,
    @inject('services.Reddit')
    private redditService: Reddit,
  ) {}

  async fetchTweet(textId: string): Promise<ExtendedPost> {
    let response = null;
    const expansions =
      'author_id,attachments.media_keys,referenced_tweets.id,referenced_tweets.id.author_id';
    const tweetFields = 'attachments,entities,created_at';
    const mediaFields = 'url,variants';
    const userFields = 'profile_image_url';

    try {
      response = await this.twitterService.getActions(
        `2/tweets/${textId}?expansions=${expansions}&tweet.fields=${tweetFields}&media.fields=${mediaFields}&user.fields=${userFields}`,
      );
    } catch (err) {
      switch (err.statusCode) {
        case 403:
          throw new HttpErrors.Forbidden('Tweet protected by user');

        case 404:
          throw new HttpErrors.NotFound('Tweet not found');

        default:
          throw new HttpErrors.BadRequest('Invalid tweet url');
      }
    }

    const {data, includes} = response;
    const {
      id: idStr,
      text: fullText,
      created_at: createdAt,
      author_id: author,
      referenced_tweets: references,
      entities,
      attachments,
    } = data;
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    const users: any[] = includes.users;
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    let user: any;
    users.forEach(element => {
      if (element.id === author) {
        user = element;
      }
    });
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    let quotedStatus: any;
    if (typeof references !== 'undefined') {
      /* eslint-disable  @typescript-eslint/no-explicit-any */
      const reference: any[] = references;
      // let user = users.filter(user => (user.id === author))[0];
      const quote: any[] = reference.filter(
        referenced => referenced.type === 'quoted',
      );

      /* eslint-disable  @typescript-eslint/no-explicit-any */
      const tweets: any[] = includes.tweets;
      if (quote.length > 0) {
        quotedStatus = tweets.filter(tweet => tweet.id === quote[0].id)[0];
        quotedStatus.user = users.filter(
          quoter => quoter.id === quotedStatus.author_id,
        )[0];
      } else {
        quotedStatus = null;
      }
    } else {
      quotedStatus = null;
    }

    const asset: Omit<Asset, 'exclusiveContents'> = {
      images: [],
      videos: [],
    };

    const twitterTags = entities
      ? entities.hashtags
        ? entities.hashtags.map((hashtag: AnyObject) =>
            hashtag.tag.toLowerCase(),
          )
        : []
      : [];

    let text: String = fullText;
    if (attachments) {
      const medias = includes.media;
      const images: Sizes[] = [];

      for (const media of medias) {
        text = text.replace(media.url, '');

        if (media.type === 'photo') {
          const imageURL = media.url;

          images.push({
            original: imageURL,
            thumbnail: `${imageURL}?name=thumb`,
            small: `${imageURL}?name=small`,
            medium: `${imageURL}?name=medium`,
            large: `${imageURL}?name=large`,
          });
        } else {
          const variants: any[] = media.variants;

          for (const variant of variants) {
            if (variant.content_type === 'video/mp4') {
              asset.videos.push(variant.url.split('?tag=12')[0]);
              break;
            }
          }
        }
      }

      if (images.length > 0) asset.images = images;
    }
    if (typeof entities?.url !== 'undefined') {
      for (const entity of entities?.urls as AnyObject[]) {
        const url = entity.url;
        const expandedURL = entity.expanded_url;

        text = text.replace(url, expandedURL);
      }
    }

    let embedded = null;
    let embeddedURL = entities?.urls
      ? entities?.urls[entities.urls.length - 1]?.expanded_url
      : null;

    if (embeddedURL && asset.images.length === 0 && asset.videos.length === 0) {
      try {
        if (!validateURL(embeddedURL)) throw new Error('InvalidURL');
        if (quotedStatus) {
          const quoteEntities = quotedStatus?.entities?.urls ?? [];

          let description = quotedStatus?.text ?? '';

          quoteEntities.forEach((entity: AnyObject) => {
            description = description.replace(
              entity?.url ?? '',
              entity?.expanded_url ?? '',
            );
          });

          const defaultImage =
            'https://res.cloudinary.com/dsget80gs/background/profile-default-bg.png';

          embeddedURL =
            quotedStatus?.user?.username && quotedStatus?.id
              ? `https://twitter.com/${quotedStatus.user?.username}/status/${quotedStatus.id}`
              : '';

          embedded = new EmbeddedURL({
            title: quotedStatus?.user?.username ?? '',
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
      url: `https://twitter.com/${user.id}/status/${textId}`,
      platformUser: {
        name: user.name,
        username: user.username,
        originUserId: user.id,
        profilePictureURL: user.profile_image_url || '',
        platform: PlatformType.TWITTER,
      },
    } as ExtendedPost;
  }

  async fetchRedditPost(
    textId: string,
    pathname: string,
  ): Promise<ExtendedPost> {
    let data = null;

    try {
      const encodedPath = encodeURIComponent(`${pathname}.json`);

      [data] = await this.redditService.getActions(encodedPath);
    } catch {
      throw new HttpErrors.BadRequest('Invalid reddit url');
    }

    const redditPost = data.data.children[0].data;
    const text = redditPost.selftext;
    const asset: Omit<Asset, 'exclusiveContents'> = {
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
      const images: Sizes[] = [];
      for (const img in redditPost.media_metadata) {
        const rawAsset = redditPost.media_metadata[img];
        if (rawAsset.e === 'Image') {
          const originalImage = rawAsset.s.u.replace(/amp;/g, '');
          const image: Sizes = {
            original: originalImage,
            thumbnail: originalImage,
            small: originalImage,
            medium: originalImage,
            large: originalImage,
          };

          for (let i = 0; i < rawAsset.p.length; i++) {
            let size = null;
            switch (i) {
              case 0:
                size = 'thumbnail';
                break;

              case 1:
                size = 'small';
                break;

              case 2:
                size = 'medium';
                break;

              case 3:
                size = 'large';
                break;
            }

            if (size && rawAsset?.p?.[i]?.u) {
              image[size as keyof Sizes] = rawAsset.p[i].u.replace(/amp;/g, '');
            }
          }

          images.push(image);
        }

        if (rawAsset.e === 'RedditVideo') {
          asset.videos.push(
            `https://reddit.com/link/${textId}/video/${redditPost.media_metadata[img].id}/player`,
          );
        }
      }

      if (images.length) asset.images = images;
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
          if (!validateURL(url)) throw new Error('InvalidURL');
          embedded = await getOpenGraph(url);
        } catch {
          // ignore
        }
      }
    }

    if (
      asset.images.length > 0 &&
      typeof asset.images[0] === 'string' &&
      !redditPost.media_metadata &&
      redditPost.preview
    ) {
      const previewImages = redditPost.preview?.images ?? [];
      const images: Sizes[] = [];

      for (const previewImage of previewImages) {
        const originalImage = previewImage.source.url.replace(/amp;/g, '');
        const image: Sizes = {
          original: originalImage,
          thumbnail: originalImage,
          small: originalImage,
          medium: originalImage,
          large: originalImage,
        };

        const imageResolution = previewImage?.resolutions ?? [];
        for (let j = 0; j < imageResolution.length; j++) {
          let size = null;
          switch (j) {
            case 0:
              size = 'thumbnail';
              break;

            case 1:
              size = 'small';
              break;

            case 2:
              size = 'medium';
              break;

            case 3:
              size = 'large';
              break;
          }

          if (size && imageResolution?.[j]?.url) {
            const processImage = imageResolution[j].url.replace(/amp;/g, '');
            image[size as keyof Sizes] = processImage;
          }
        }

        images.push(image);
      }

      if (images.length > 0) asset.images = images;
    }

    const redditUser = redditPost.author;

    let user = null;

    try {
      ({data: user} = await this.redditService.getActions(
        'user/' + redditUser + '/about.json',
      ));
    } catch {
      throw new HttpErrors.BadRequest(
        'This reddit post not belong to any user',
      );
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

  public async verifyToTwitter(
    username: string,
    address: string,
  ): Promise<People> {
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
    if (!tweets) {
      throw new HttpErrors.NotFound('Tweet not found/protected by user');
    }

    // Verify that the publicKey is existing in user twitter
    const found = tweets[0]?.text
      .replace(/\n/g, ' ')
      .split(' ')
      .find((tweet: string) => tweet === address);

    if (!found) throw new HttpErrors.NotFound('Cannot find specified post');

    return new People({
      name: user.name,
      originUserId: user.id,
      platform: PlatformType.TWITTER,
      username: user.username,
      profilePictureURL: user.profile_image_url || '',
    });
  }

  public async verifyToReddit(
    username: string,
    address: string,
  ): Promise<People> {
    try {
      const [{data: redditUser}, {data: redditPost}] = await Promise.all([
        this.redditService.getActions(`user/${username}/about.json`),
        this.redditService.getActions(`user/${username}/.json?limit=1`),
      ]);
      const found = redditPost?.children[0]?.data?.title
        .replace(/\n/g, ' ')
        .split(' ')
        .find((post: string) => post === address);

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
}
