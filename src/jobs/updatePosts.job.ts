import {CronJob, cronJob} from '@loopback/cron';
import {repository} from '@loopback/repository';
import {
    PeopleRepository,
    PostRepository,


    QueueRepository, TagRepository,
    UserCredentialRepository
} from '../repositories';

@cronJob()
export class UpdatePostsJob extends CronJob {
    constructor(
        @repository(PostRepository) public postRepository: PostRepository,
        @repository(PeopleRepository) public peopleRepository: PeopleRepository,
        @repository(TagRepository) public tagRepository: TagRepository,
        @repository(UserCredentialRepository) public userCredentialRepository: UserCredentialRepository,
        @repository(QueueRepository) public queueRepository: QueueRepository
    ) {
        super({
            name: 'update-wallet-address-job',
            onTick: async () => {
                await this.performJob();
            },
            cronTime: '0 0 */1 * * *', // Every hour
            start: true
        })
    }

    async performJob() {
        try {
            await this.updatePeoplePost()
        } catch (e) {
            console.log(e)
        }
    }
    
    async updatePeoplePost() {
        try {
            const posts = await this.postRepository.find()
            const people = await this.peopleRepository.find()
            const filterPosts = posts.filter(post => !post.peopleId)

            filterPosts.forEach(async post => {
                let foundPeople = null;

                if (post.platformUser) {
                    const platform_account_id = post.platformUser.platform_account_id;
                    foundPeople = people.find(person => person.platform_account_id === platform_account_id)
                }

                if (foundPeople) {
                    await this.postRepository.updateById(post.id, {
                        peopleId: foundPeople.id
                    })
                }
            })
        } catch (err) { }
    }
}
