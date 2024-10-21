import { inject, Provider } from '@loopback/core';
import { getService } from '@loopback/service-proxy';
import { TwitchDataSource } from '../../datasources';

interface TwitchClipData {
  broadcasterName: string;
  createdAt: string | number | Date;
  id: string;
  embedUrl: string;
  thumbnailUrl: string;
  length: number;
  title: string;
  url: string;
  broadcasterId: string;
}

interface TwitchClip {
  data: TwitchClipData;
  id: string;
}

interface TwitchVideoData {
  title: string;
  url: string;
  broadcasterId: string;
}

interface TwitchVideo {
  data: TwitchVideoData;
  id: string;
}

interface TwitchUserData {
  profileImageUrl: string;
  login: string;
  displayName: string;
  id: string;
}

interface TwitchUser {
  data: TwitchUserData;
  id: string;
}

export interface Twitch {
  getClipById(clipId: string): Promise<TwitchClip>;
  getVideoById(id: string): Promise<TwitchVideo>;
  getUserById(id: string): Promise<TwitchUser>;
}

export class TwitchProvider implements Provider<Twitch> {
  constructor(
    @inject('datasources.twitch')
    protected dataSource: TwitchDataSource = new TwitchDataSource(),
  ) {}

  value(): Promise<Twitch> {
    return getService(this.dataSource);
  }
}