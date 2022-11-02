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
      cronTime: '0 */30 * * * *',
      start: true,
    });
  }

  async performJob() {
    const oneDay = 24 * 60 * 60 * 1000;

    await this.tagRepository.updateAll(
      {count: 1},
      {updatedAt: {lt: new Date(Date.now() - oneDay).toString()}},
    );
  }
}
