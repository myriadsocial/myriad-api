import {BindingScope, injectable} from '@loopback/core';
import * as firebaseAdmin from 'firebase-admin';

@injectable({scope: BindingScope.TRANSIENT})
export class FCMService {
  constructor() { }

  async sendNotification(fcmTokens?: string[], title?: string, body?: string): Promise<void> {
    if (fcmTokens == null || fcmTokens.length <= 0) return
    console.log(fcmTokens)

    const message = {
      notification: {
        title: title,
        body: body,
      },
      tokens: fcmTokens,
    };

    let result = await firebaseAdmin.messaging().sendMulticast(message);
    console.log(result)

    return
  }
}
