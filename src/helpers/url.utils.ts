import {PlatformType} from '../enums';

export class UrlUtils {
  detail: string[];

  constructor(socialMediaURL: string) {
    this.detail = socialMediaURL
      .replace(/(https?:\/\/)?(www.)?/i, '')
      .replace(new RegExp(/user\/|u\/|r\//), '')
      .split('/');
  }

  getPlatform(): PlatformType {
    return this.detail[0].split('.')[0] as PlatformType;
  }

  getTextId(): string {
    return this.detail[3];
  }

  getUsername(): string {
    return this.detail[1];
  }
}
