import {inject} from '@loopback/core'
import {CronJob, cronJob} from '@loopback/cron'
import {repository} from '@loopback/repository'
import {PostRepository} from '../repositories'
import {Twitter} from '../services'

@cronJob()

export class FetchContentTwitterJob extends CronJob {
  constructor(
    @inject('services.Twitter') protected twitterService:Twitter,
    @repository(PostRepository) public postRepository:PostRepository
  ) {
    super({
      name: 'fetch-content-twitter-job',
      onTick: async () => {
        await this.performJob();
      },
      cronTime: '*/1 * * * * *',
      start: true
    })
  }

  async performJob () {
    // console.log('heloo world')
  }
}