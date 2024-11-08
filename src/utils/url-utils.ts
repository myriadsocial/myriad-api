import {AnyObject} from '@loopback/repository';
import {omit} from 'lodash';
import ogs from 'open-graph-scraper';
import validator from 'validator';
import {PlatformType} from '../enums';
import {EmbeddedURL, Media} from '../models';

export class UrlUtils {
  private url: URL;

  constructor(socialMediaURL: string) {
    this.url = new URL(socialMediaURL);
  }

  getPathname(): string {
    return this.url.pathname.substring(1);
  }

  getPlatform(): PlatformType {
    return this.url.host.replace(/www./gi, '').split('.')[0] as PlatformType;
  }

  getOriginPostId(): string {
    const platform = this.getPlatform();
    const pathname = this.url.pathname;
    let postId = '';

    switch (platform) {
      case PlatformType.YOUTUBE:
        if (pathname === '/watch') {
          // Handle standard YouTube URLs: https://www.youtube.com/watch?v=VIDEO_ID
          postId = this.url.searchParams.get('v') ?? '';
        } else if (this.url.hostname === 'youtu.be') {
          // Handle shortened YouTube URLs: https://youtu.be/VIDEO_ID
          postId = pathname.substring(1);
        }
        break;

      case PlatformType.REDDIT:
      case PlatformType.TWITTER:
        // Handle Reddit and Twitter URLs
        postId =
          pathname
            .replace(new RegExp(/\/user\/|\/u\/|\/r\//), '/')
            .split('/')[3] || '';
        break;
      default:
        postId = '';
    }

    return postId;
  }

  static async getOpenGraph(url: string): Promise<EmbeddedURL | null> {
    const {result} = ogs({url});
    const embeddedURL = new EmbeddedURL();
    const embedded: AnyObject = result;

    if (!embedded.ogImage) return null;

    embeddedURL.description = embedded.ogDescription ?? '';
    embeddedURL.title = embedded.ogTitle ?? '';
    embeddedURL.siteName = embedded.ogSiteName ?? '';
    embeddedURL.url = embedded.ogUrl ?? '';
    embeddedURL.image = new Media(omit(embedded.ogImage, ['type']));

    if (embedded.ogVideo) {
      embeddedURL.video = new Media(omit(embedded.ogVideo, ['type']));
    }

    return embeddedURL;
  }

  /* eslint-disable   @typescript-eslint/naming-convention */
  static validateURL(url?: string): boolean {
    if (!url) return false;

    const isURL = validator.isURL(url, {
      require_protocol: true,
      require_valid_protocol: true,
      protocols: ['http', 'https', 'ws', 'wss'],
    });

    return isURL;
  }
}
