import ogs from 'open-graph-scraper';
import {PlatformType} from '../enums';
import {EmbeddedURL, Media} from '../models';
import validator from 'validator';
import {HttpErrors} from '@loopback/rest';
import {AnyObject} from '@loopback/repository';
import {omit} from 'lodash';

export class UrlUtils {
  detail: string[];

  constructor(socialMediaURL = '') {
    this.detail = this.getDetail(socialMediaURL);
  }

  getDetail(socialMediaURL: string): string[] {
    return socialMediaURL
      ? socialMediaURL
          .replace(/(https?:\/\/)?(www.)?/i, '')
          .replace(new RegExp(/\/user\/|\/u\/|\/r\//), '/')
          .split('/')
      : [];
  }

  getPlatform(): PlatformType {
    return this.detail[0].split('.')[0] as PlatformType;
  }

  getOriginPostId(): string {
    return this.detail[3];
  }

  getUsername(): string {
    return this.detail[1];
  }

  async getOpenGraph(url: string): Promise<EmbeddedURL | null> {
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
  validateURL(url?: string): void {
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
