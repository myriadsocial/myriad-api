import {CronJob, cronJob} from '@loopback/cron'
import {repository} from '@loopback/repository'
import {PostRepository, PeopleRepository, TagRepository, UserCredentialRepository} from '../repositories'
import {Post} from '../models'

@cronJob()

export class UpdatePostsJob extends CronJob {
    constructor (
        @repository(PostRepository) public postRepository:PostRepository,
        @repository(PeopleRepository) public peopleRepository:PeopleRepository,
        @repository(TagRepository) public tagRepository:TagRepository,
        @repository(UserCredentialRepository) public userCredentialRepository:UserCredentialRepository,
    ) {
        super({
            name: 'update-wallet-address-job',
            onTick: async () => {
              await this.performJob();
            },
            cronTime: '*/1800 * * * * *',
            start: true 
        })
    }

    async performJob() {
        await this.updateUserCredentialPosts()
        await this.updatePeoplePost()
    }

    async updateUserCredentialPosts () {
        try {
            const userCredentials = await this.userCredentialRepository.find()

            userCredentials.forEach(async userCredential => {
                const peopleId = userCredential.peopleId
                const posts:Post[] = await this.postRepository.find({where: {peopleId}})
                const updatedPosts = posts.map((post:Post) => {
                    return {
                        ...post,
                        wallet_address: userCredential.userId
                    }
                })

                updatedPosts.forEach(async post => {
                    await this.postRepository.updateById(post.id, post)
                })
            })
        } catch (err) {}
    }

    async updatePeoplePost () {
        try {
            const posts = await this.postRepository.find()
            const people = await this.peopleRepository.find()
            const filterPosts = posts.filter(post => !post.peopleId)

            filterPosts.forEach(async post => {
                const platform_account_id = post.platformUser.platform_account_id
                const foundPeople = people.find(person => person.platform_account_id === platform_account_id) 

                if (foundPeople) {
                    const userCredential = await this.userCredentialRepository.findOne({where: {peopleId: foundPeople.id}})

                    if (userCredential) {
                        await this.postRepository.updateById(post.id, {
                            wallet_address: userCredential.userId,
                            peopleId: foundPeople.id
                        })
                    }
                    await this.postRepository.updateById(post.id, {
                        peopleId: foundPeople.id
                    })
                }
            })
        } catch (err) {}
    }
}