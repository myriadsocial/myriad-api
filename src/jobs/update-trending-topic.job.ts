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
      cronTime: '0 0 0 * * 0',
      start: true,
    });
  }

  async performJob() {
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const data = {
      count: 1,
      updatedAt: new Date(Date.now() - oneWeek).toString(),
    };

    await this.tagRepository.updateAll(data);
  }
}
