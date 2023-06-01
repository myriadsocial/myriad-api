import {CronJob, cronJob} from '@loopback/cron';
import {repository} from '@loopback/repository';
import {TagRepository} from '../repositories';

@cronJob()
export class UpdateTrendingTopicJob extends CronJob {
  constructor(
    @repository(TagRepository)
    protected tagRepository: TagRepository,
  ) {
    super({
      name: 'update-trending-topicd-job',
      onTick: () => {
        this.performJob().finally(console.log);
      },
      // cronTime: '0 */30 * * * *',
      cronTime: '0 0 0 * * 0', // every sunday 12 am
      start: true,
    });
  }

  async performJob() {
    // const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    await this.tagRepository.updateAll(
      {count: 1},
      // {updatedAt: {lt: new Date(Date.now() - oneDay).toString()}},
      {updatedAt: {lt: new Date(Date.now() - oneWeek).toString()}},
    );
  }
}
