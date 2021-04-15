import {CronJob, cronJob} from '@loopback/cron'
import {repository} from '@loopback/repository'
import {PostRepository, PeopleRepository, TagRepository, UserCredentialRepository} from '../repositories'
import {ApiPromise, Keyring, WsProvider} from '@polkadot/api';
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
            const wsProvider = new WsProvider('wss://rpc.myriad.systems')
            const api = await ApiPromise.create({provider: wsProvider})

            await api.isReady
            
            const keyring = new Keyring({type: 'sr25519'})

            userCredentials.forEach(async userCredential => {
                const peopleId = userCredential.peopleId
                const posts:Post[] = await this.postRepository.find({where: {peopleId}})
                
                posts.forEach(async (post:Post) => {
                    if (post.walletAddress !== userCredential.userId) {
                        const from = keyring.addFromUri('//' + post.id)
                        const to = userCredential.userId
                        const value = 1000000000000
                        const transfer = api.tx.balances.transfer(to, value)

                        await transfer.signAndSend(from)

                        await this.postRepository.updateById(post.id, {
                            ...post,
                            walletAddress: userCredential.userId
                        })
                    }
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
                            walletAddress: userCredential.userId,
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