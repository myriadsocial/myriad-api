import {inject, Provider} from '@loopback/core';
import {getService} from '@loopback/service-proxy';
import {TwitterDataSource} from '../../datasources';
import { AnyObject } from '@loopback/repository';

/* eslint-disable  @typescript-eslint/no-explicit-any */
export interface Twitter {
  // this is where you define the Node.js methods that will be
  // mapped to REST/SOAP/gRPC operations as stated in the datasource
  // json file.
  getActions(action: String): Promise<any>;
}

export interface twitterReferences extends AnyObject {
  id: any ,
  type: any ,
}

export interface Tweets extends AnyObject {
  id: any ,
  text: any ,
  attachments?: any,
  author_id?: any,
  created_at?: any,
  entities?: any,
  referenced_tweets?: any,
  user?: twitterUser,
}

export interface twitterUser extends AnyObject {
  id: any ,
  name: any ,
  username: any ,
  profile_image_url?: any ,
}

export class TwitterProvider implements Provider<Twitter> {
  constructor(
    // twitter must match the name property in the datasource json file
    @inject('datasources.twitter')
    protected dataSource: TwitterDataSource = new TwitterDataSource(),
  ) {}

  value(): Promise<Twitter> {
    return getService(this.dataSource);
  }
}
