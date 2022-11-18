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

  private async sendMagicLink(
    user: User,
    callbackURL: string,
    token: string,
    subject: string,
    message: string,
  ): Promise<SentMessageInfo> {
    const transporter = await EmailService.setupTransporter();
    const senderAddress = config.SMTP_SENDER_ADDRESS ?? config.SMTP_USERNAME;
    const url = new URL(callbackURL);
    url.searchParams.set('token', token);

    const emailTemplate = new EmailTemplate({
      from: senderAddress,
      to: user.email,
      subject: subject,
      html: `
      <div>
          <p>Hello, ${user.name}</p>
          <p>${message}</p>
          <a href="${url.toString()}">${url.toString()}</a>
          <p>Make sure this email was sent by ${senderAddress}</p>
          <p>Make sure you are redirected to ${callbackURL}</p>
          <p>Do not share this email with anyone</p>
          <p>This link is valid up to 30 minutes after you’ve received it.</p>
          <p>Thanks,</p>
          <p>Myriad Team</p>
      </div>
      `,
    });

    return transporter.sendMail(emailTemplate);
  }

  async sendCreateAccountMagicLink(
    user: User,
    callbackURL: string,
    token: string,
  ): Promise<SentMessageInfo> {
    const subject = 'Create Account Verification';
    const message =
      'You are about to create a new account on Myriad Social. If you want to confirm this action, click on this link or paste it in your browser.';

    return this.sendMagicLink(user, callbackURL, token, subject, message);
  }

  async sendLoginMagicLink(
    user: User,
    callbackURL: string,
    token: string,
  ): Promise<SentMessageInfo> {
    const subject = 'Login Request';
    const message = 'Follow this link to sign-in!';

    return this.sendMagicLink(user, callbackURL, token, subject, message);
  }

  async sendAddEmailMagicLink(
    user: User,
    callbackURL: string,
    token: string,
  ): Promise<SentMessageInfo> {
    const subject = 'Add Email Verification';
    const message =
      'You are requesting to add this email to Myriad Social. If you want to confirm this action, click on this link or paste it in your browser.';

    return this.sendMagicLink(user, callbackURL, token, subject, message);
  }

  async sendRemoveEmailMagicLink(
    user: User,
    callbackURL: string,
    token: string,
  ): Promise<SentMessageInfo> {
    const subject = 'Remove Email Verification';
    const message =
      'You are requesting to remove this email from Myriad Social. If you want to confirm this action, click on this link or paste it in your browser.';

    return this.sendMagicLink(user, callbackURL, token, subject, message);
  }
}
