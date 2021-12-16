import {CronJob, cronJob} from '@loopback/cron';
import {inject} from '@loopback/core';
import {Reddit, Twitter} from '../services';
import {repository} from '@loopback/repository';
import {PeopleRepository} from '../repositories';
import {PlatformType} from '../enums';
import {People} from '../models';

@cronJob()
export class UpdatePeopleProfileJob extends CronJob {
  constructor(
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @inject('services.Twitter')
    protected twitterService: Twitter,
    @inject('services.Reddit')
    protected redditService: Reddit,
  ) {
    super({
      name: 'update-people-profile-job',
      onTick: async () => {
        await this.performJob();
      },
      cronTime: '0 0 0 */30 * *',
      start: true,
    });
  }

  async performJob() {
    const people = await this.peopleRepository.find();

    await Promise.all(
      people.map(async person => {
        const platform = person.platform;

        if (platform === PlatformType.REDDIT) {
          try {
            const {data: user} = await this.redditService.getActions(
              'user/' + person.username + '/about.json',
            );

            const updatedPeople = new People({
              name: user.subreddit.title ? user.subreddit.title : user.name,
              username: user.name,
              originUserId: 't2_' + user.id,
              profilePictureURL: user.icon_img.split('?')[0],
            });

            return await this.peopleRepository.updateById(
              person.id,
              updatedPeople,
            );
          } catch {
            // ignore
          }
        }

        if (platform === PlatformType.TWITTER) {
          try {
            const {user} = await this.twitterService.getActions(
              `1.1/statuses/show.json?id=${person.originUserId}&include_entities=true&tweet_mode=extended`,
            );

            const updatedPeople = new People({
              name: user.name,
              username: user.screen_name,
              originUserId: user.id_str,
              profilePictureURL: user.profile_image_url_https || '',
            });

            return await this.peopleRepository.updateById(
              person.id,
              updatedPeople,
            );
          } catch {
            // ignore
          }
        }
      }),
    );
  }
}
