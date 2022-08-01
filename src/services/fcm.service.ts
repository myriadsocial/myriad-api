import {BindingScope, injectable} from '@loopback/core';
import {AnyObject} from '@loopback/repository';
import * as firebaseAdmin from 'firebase-admin';

@injectable({scope: BindingScope.TRANSIENT})
export class FCMService {
  constructor() {}

  async sendNotification(
    fcmTokens?: string[],
    title?: string,
    body?: string,
    data?: AnyObject,
  ): Promise<void> {
    if (fcmTokens == null || fcmTokens.length <= 0) return;

    const message = {
      tokens: fcmTokens,
      data: {
        title: `${title}`,
        body: `${body}`,
        data: JSON.stringify(data),
      },
    };

    try {
      await firebaseAdmin.messaging().sendMulticast(message);
    } catch {
      // ignore
    }

    return;
  }
}
