import {CronJob, cronJob} from '@loopback/cron';
import {repository} from '@loopback/repository';
import {PostRepository} from '../repositories';

@cronJob()

export class RemovedContentJob extends CronJob {
  constructor(
    @repository(PostRepository) public postRepository: PostRepository
  ) {
    super({
      name: "removed-content-job",
      onTick: async () => {
        await this.performJob();
      },
      cronTime: '*/1 * * * * *',
      start: true,
    })
  }

  async performJob() {
    try {
      this.postRepository.deleteAll({
        or: [
          {
            text: "[removed]",
          },
          {
            text: "[deleted]",
          }
        ]
      })

    } catch (err) {} 
  }
}