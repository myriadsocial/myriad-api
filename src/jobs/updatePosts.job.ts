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
            // cronTime: '*/10 * * * * *',
            start: true
        })
    }

    async performJob() {
        try {
            // await this.updatePeoplePost()
            await this.updatePeopleCredentialPost()
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
                    const {username, platform_account_id} = post.platformUser;

                    if (post.platform === 'facebook') {     
                        foundPeople = people.find(person => person.username === username)
                    } else {
                        foundPeople = people.find(person => person.platform_account_id === platform_account_id)
                    }
                }

                if (foundPeople) {
                    this.postRepository.updateById(post.id, {
                        peopleId: foundPeople.id
                    })
                }
            })
        } catch (err) { }
    }

    async updatePeopleCredentialPost () {
        try {
            const credential = await this.userCredentialRepository.find()

            for (let i = 0; i < credential.length; i++) {
                const foundPost = await this.postRepository.find({
                    where: {
                        peopleId: credential[i].peopleId,
                        importBy: {
                            nin: [[credential[i].userId]]
                        }
                    }
                })

                const updatedPost = foundPost.map(post => {
                    post.importBy = [
                        ...post.importBy,
                        credential[i].userId
                    ]

                    return post
                })

                for (let j = 0; j < updatedPost.length; j++) {
                    this.postRepository.updateById(updatedPost[j].id, {
                        importBy: updatedPost[j].importBy
                    })
                }
            }
        } catch (err) {

        }
    }
}
