// import {inject} from '@loopback/core';
// import {CronJob, cronJob} from '@loopback/cron';
// import {repository} from '@loopback/repository';
// import {xml2json} from 'xml-js';
// import {PostRepository} from '../repositories';
// import {Rsshub} from '../services';

// @cronJob()
// export class FetchContentJob extends CronJob {
//   constructor(
//     @inject('services.Rsshub') protected rsshubService: Rsshub,
//     @repository(PostRepository) public postRepository: PostRepository,
//   ) {
//     super({
//       name: 'fetch-content-job',
//       onTick: async () => {
//         // do the work
//         await this.performJob();
//       },
//       cronTime: '*/1800 * * * * *', // Every ten second
//       start: true,
//     });
//   }

//   async performJob() {
//     const platform = 'twitter'
//     const tags = 'blockchain'

//     const resultXML = await this.callAPI(platform, tags);
//     console.log(resultXML)
//     if (resultXML == null) return

//     let resultJSON = null
//     try {
//       resultJSON = await xml2json(resultXML, {compact: true, trim: true});
//     } catch (error) { }
//     console.log(resultJSON)
//     if (resultJSON == null) return
//     interface Response {
//       rss: {
//         channel: {
//           item: [
//             {
//               link: {
//                 _text: String
//               }
//             }
//           ]
//         }
//       }
//     }

//     let response: Response = JSON.parse(resultJSON);
//     console.log(response)
//     const items = response.rss.channel.item;
//     console.log(items)
//     if (items == null) return

//     for (let i = 0; i < items.length; i++) {
//       const contentURL = items[i].link._text;
//       if (contentURL == null) continue

//       const content = await this.postRepository.findOne({
//         where: {url: contentURL.toString()}
//       })

//       if (content != null) {
//         let newTags: String[] = []
//         if (content.tags != null) newTags = content.tags
//         newTags.indexOf(tags) === -1 && newTags.push(tags);
//         await this.postRepository.updateAll({tags: newTags}, {id: content.id})
//         continue
//       }

//       await this.postRepository.create({
//         tags: [tags],
//         platformId: platform,
//         url: contentURL.toString()
//       })
//     }
//   }

//   async callAPI(platform: String, tag: String): Promise<any> {
//     let result = null
//     try {
//       result = await this.rsshubService.getContents(platform, tag);
//     } catch (error) { }

//     return result
//   }
// }
