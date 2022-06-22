import ogs from 'open-graph-scraper';
import {PlatformType} from '../enums';
import {EmbeddedURL, Media} from '../models';
import validator from 'validator';
import {HttpErrors} from '@loopback/rest';
import {AnyObject} from '@loopback/repository';
import {omit} from 'lodash';

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
    return this.url.pathname
      .replace(new RegExp(/\/user\/|\/u\/|\/r\//), '/')
      .split('/')[3];
  }

  static async getOpenGraph(url: string): Promise<EmbeddedURL | null> {
    const {result} = await ogs({url});
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
  static validateURL(url?: string): void {
    if (!url) return;

    const isURL = validator.isURL(url, {
      require_protocol: true,
      require_valid_protocol: true,
      protocols: ['http', 'https', 'ws', 'wss'],
    });

    if (isURL) return;
    throw new HttpErrors.UnprocessableEntity('Wrong url format!');
  }
}
