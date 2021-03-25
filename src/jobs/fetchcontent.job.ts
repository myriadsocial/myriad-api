import {CronJob, cronJob} from '@loopback/cron';
// import {Rsshub} from '../services';

@cronJob()
export class FetchContentJob extends CronJob {
  constructor(
    // @inject('services.Rsshub') protected rsshubService: Rsshub,
    // @repository(ContentRepository) public contentRepository: ContentRepository,
  ) {
    super({
      name: 'fetch-content-job',
      onTick: async () => {
        // do the work
        await this.performJob();
      },
      cronTime: '*/10 * * * * *', // Every ten second
      start: true,
    });
  }

  async performJob() {
    console.log(new Date().toDateString())
    console.log(new Date().toUTCString())
    console.log(new Date().toISOString())
    console.log(new Date().toTimeString())
    // const resultXML = await this.callAPI('twitter', 'blockchain');
    // const resultJSON = await xml2json(resultXML, {compact: true, trim: true});
    // interface Response {
    //   rss: {
    //     channel: {
    //       item: [
    //         {
    //           link: {
    //             _text: String
    //           }
    //         }
    //       ]
    //     }
    //   }
  }

  // let response: Response = JSON.parse(resultJSON);
  // const items = response.rss.channel.item;

  // for (let i = 0; i < items.length; i++) {
  //   const contentURL = items[i].link._text;
  //   const content = await this.contentRepository.findOne({
  //     where: {url: contentURL.toString()}
  //   })
  //   if (content != null) continue
  //   await this.contentRepository.create({
  //     topic_ids: ["605464e3ba42ccd5908d6017"],
  //     platform_id: "605464baba42ccd5908d6016",
  //     url: contentURL.toString()
  //   })
  // }
  // }

  // async callAPI(platform: String, topic: String): Promise<any> {
  //   return await this.rsshubService.getContents(platform, topic);
  // }

  // async saveData(platformId: String, topicId: String, newURL: String) {
  //   //   const content = await this.contentRepository.findOne({
  //   //     where: {url: newURL}
  //   //   })

  //   //   if (content != null) return

  //   //   await this.contentRepository.create({
  //   //     topic_ids: [topicId],
  //   //     platform_id: platformId,
  //   //     url: newURL
  //   //   })
  //   // }
}
