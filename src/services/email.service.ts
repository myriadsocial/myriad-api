import {injectable, BindingScope} from '@loopback/core';
import {User} from '../models';
import {EmailTemplate} from '../models/email-template.model';
import {createTestAccount, createTransport, SentMessageInfo} from 'nodemailer';
import {config} from '../config';

@injectable({scope: BindingScope.TRANSIENT})
export class EmailService {
  private static async setupTransporter() {
    if (!config.SMTP_USERNAME) {
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
      from: config.SMTP_SENDER_ADDRESS,
      to: user.email,
      subject: 'Login Request',
      html: `
      <div>
          <p>Hello, ${user.name}</p>
          <p>Follow this link to login.</p>
          <a href="${url.toString()}">${url.toString()}</a>
          <p>Do not share this email with anyone</p>
          <p>Thanks,</p>
      </div>
      `,
    });

    return transporter.sendMail(emailTemplate);
  }
}