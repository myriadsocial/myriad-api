import {CronJob, cronJob} from '@loopback/cron';
import {repository} from '@loopback/repository';
import {Keyring} from '@polkadot/api';
import {polkadotApi} from '../helpers/polkadotApi';
import {Post} from '../models';
import {PeopleRepository, PostRepository, TagRepository, UserCredentialRepository} from '../repositories';

@cronJob()
export class UpdatePostsJob extends CronJob {
    constructor(
        @repository(PostRepository) public postRepository: PostRepository,
        @repository(PeopleRepository) public peopleRepository: PeopleRepository,
        @repository(TagRepository) public tagRepository: TagRepository,
        @repository(UserCredentialRepository) public userCredentialRepository: UserCredentialRepository,
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
        try {
            await this.updateUserCredentialPosts()
            await this.updatePeoplePost()
        } catch (e) {
            console.log(e)
        }
    }

    async updateUserCredentialPosts() {
        try {
            const userCredentials = await this.userCredentialRepository.find()
            const api = await polkadotApi()
            const keyring = new Keyring({type: 'sr25519', ss58Format: 214})

            userCredentials.forEach(async userCredential => {
                const peopleId = userCredential.peopleId
                const posts: Post[] = await this.postRepository.find({where: {peopleId}})

                posts.forEach(async (post: Post) => {
                    if (post.walletAddress !== userCredential.userId) {
                        const from = keyring.addFromUri('//' + post.id)
                        const to = userCredential.userId
                        const {data: balance} = await api.query.system.account(from.address);
                        const transfer = api.tx.balances.transfer(to, balance.free)

                        await transfer.signAndSend(from)

                        await this.postRepository.updateById(post.id, {
                            ...post,
                            walletAddress: userCredential.userId
                        })
                    }
                })
            })
        } catch (err) { }
    }

    async updatePeoplePost() {
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
                            walletAddress: userCredential.userId,
                            peopleId: foundPeople.id
                        })
                    }

                    await this.postRepository.updateById(post.id, {
                        peopleId: foundPeople.id
                    })
                }
            })
        } catch (err) { }
    }
}
