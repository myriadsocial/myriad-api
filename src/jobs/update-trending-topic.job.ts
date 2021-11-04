import {CronJob, cronJob} from '@loopback/cron';
import {repository} from '@loopback/repository';
import {TagRepository} from '../repositories';
import {DateUtils} from '../utils/date-utils';

@cronJob()
export class UpdateTrendingTopicJob extends CronJob {
  constructor(
    @repository(TagRepository)
    protected tagRepository: TagRepository,
  ) {
    super({
      name: 'update-trending-topicd-job',
      onTick: async () => {
        await this.performJob();
      },
      cronTime: '0 */30 * * * *',
      start: true,
    });
  }

  async performJob() {
    const dateUtils = new DateUtils();
    const oneDay = dateUtils.day;

    await this.tagRepository.updateAll(
      {count: 1},
      {updatedAt: {lt: new Date(Date.now() - oneDay).toString()}},
    );
  }
}
