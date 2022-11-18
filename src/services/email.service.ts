import {injectable, BindingScope} from '@loopback/core';
import {User} from '../models';
import {EmailTemplate} from '../models/email-template.model';
import {createTestAccount, createTransport, SentMessageInfo} from 'nodemailer';
import {config} from '../config';

@injectable({scope: BindingScope.TRANSIENT})
export class EmailService {
  private static async setupTransporter() {
    if (!config.SMTP_USERNAME || !config.SMTP_PASSWORD) {
      const testAccount = await createTestAccount();

      return createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } else {
      return createTransport({
        host: config.SMTP_SERVER,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465,
        auth: {
          user: config.SMTP_USERNAME,
          pass: config.SMTP_PASSWORD,
        },
      });
    }
  }

  async sendLoginMagicLink(
    user: User,
    callbackURL: string,
    token: string,
  ): Promise<SentMessageInfo> {
    const transporter = await EmailService.setupTransporter();
    const url = new URL(callbackURL);
    url.searchParams.set('token', token);

    const emailTemplate = new EmailTemplate({
      from: config.SMTP_SENDER,
      to: user.email,
      subject: 'Login Request',
      html: `
      <div>
          <p>Hello, ${user.name}</p>
          <p>Follow this link to sign-in!</p>
          <a href="${url.toString()}">${url.toString()}</a>
          <p>Make sure this email was sent by ${config.SMTP_SENDER}</p>
          <p>Make sure you are redirected to ${callbackURL}</p>
          <p>Do not share this email with anyone</p>
          <p>This link is valid up to 30 minutes after you’ve received it.</p>
          <p>Thanks,</p>
      </div>
      `,
    });

    return transporter.sendMail(emailTemplate);
  }
}
