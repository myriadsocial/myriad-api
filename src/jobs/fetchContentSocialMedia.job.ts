import {CronJob, cronJob} from '@loopback/cron';

@cronJob()
export class FetchContentSocialMediaJob extends CronJob {
  constructor() {
    super({
      name: 'fetch-content-twitter-job',
      onTick: async () => {
        await this.performJob();
      },
      cronTime: '0 0 */1 * * *',
      start: true,
    });
  }

  async performJob() {
    // TODO: Removing for this sprint 10
    console.log('hello world');
  }
}
