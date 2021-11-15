import {BindingScope, injectable} from '@loopback/core';
import {AnyObject} from '@loopback/repository';
import * as firebaseAdmin from 'firebase-admin';

@injectable({scope: BindingScope.TRANSIENT})
export class FCMService {
  constructor() {}

  async sendNotification(
    fcmTokens?: string[],
    data?: AnyObject,
  ): Promise<void> {
    if (fcmTokens == null || fcmTokens.length <= 0) return;

    const message = {
      tokens: fcmTokens,
      data: data,
    };

    await firebaseAdmin.messaging().sendMulticast(message);

    return;
  }
}
