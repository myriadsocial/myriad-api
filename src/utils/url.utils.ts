import ogs from 'open-graph-scraper';
import {PlatformType} from '../enums';
import {EmbeddedURL, Media} from '../models';

/* eslint-disable  @typescript-eslint/no-explicit-any */
export class UrlUtils {
  detail: string[];

  constructor(socialMediaURL?: string) {
    this.detail = this.getDetail(socialMediaURL ?? '');
  }

  getDetail(socialMediaURL: string): string[] {
    return socialMediaURL
      ? socialMediaURL
          .replace(/(https?:\/\/)?(www.)?/i, '')
          .replace(new RegExp(/user\/|u\/|r\//), '')
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

  async getOpenGraph(url: string): Promise<EmbeddedURL> {
    const {result} = await ogs({url});
    const embeddedURL = new EmbeddedURL();
    const embedded: any = result;

    embeddedURL.description = embedded.ogDescription ?? '';
    embeddedURL.title = embedded.ogTitle ?? '';
    embeddedURL.siteName = embedded.ogSiteName ?? '';
    embeddedURL.url = embedded.ogUrl ?? '';

    if (embedded.ogImage) {
      delete embedded.ogImage.type;
      embeddedURL.image = new Media(embedded.ogImage);
    }

    if (embedded.ogVideo) {
      delete embedded.ogVideo.type;
      embeddedURL.video = new Media(embedded.ogVideo);
    }

    return embeddedURL;
  }
}
