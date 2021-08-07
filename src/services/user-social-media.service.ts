import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {PolkadotJs} from '../helpers/polkadotJs-utils';
import {ExtendedUser} from '../interfaces';
import {UserSocialMedia} from '../models';
import {PeopleRepository, UserSocialMediaRepository} from '../repositories';

export class UserSocialMediaService {
  constructor(
    @repository(UserSocialMediaRepository)
    protected userSocialMediaRepository: UserSocialMediaRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
  ) {}

  async createSocialMedia(user: ExtendedUser): Promise<UserSocialMedia> {
    const {name, originUserId, username, platform, profilePictureURL, publicKey} = user;

    // Verify SocialMedia
    const userSocialMedia = await this.userSocialMediaRepository.findOne({
      where: {
        userId: publicKey,
        platform: platform,
      },
    });

    if (userSocialMedia) {
      const person = await this.peopleRepository.findOne({
        where: {
          id: userSocialMedia.peopleId,
        },
      });

      if (person && person.originUserId !== originUserId) {
        throw new HttpErrors.NotFound(`This ${person.platform} does not belong to you!`);
      }
    }

    const people = await this.peopleRepository.findOne({
      where: {originUserId, platform},
    });

    if (people) {
      const peopleSocialMedia = await this.userSocialMediaRepository.findOne({
        where: {
          peopleId: people.id,
          platform: platform,
        },
      });

      if (!peopleSocialMedia) {
        return this.peopleRepository.userSocialMedia(people.id).create({
          userId: publicKey,
          platform: platform,
          verified: true,
        });
      }

      if (peopleSocialMedia.userId === user.publicKey) {
        if (peopleSocialMedia.verified) {
          throw new HttpErrors.UnprocessableEntity('You already verified this social media');
        }

        peopleSocialMedia.verified = true;
        this.userSocialMediaRepository.updateById(
          peopleSocialMedia.id,
          peopleSocialMedia,
        ) as Promise<void>;

        return peopleSocialMedia;
      }

      throw new HttpErrors.NotFound('This social media has been claimed by other user');
    }

    const newPeople = await this.peopleRepository.create({
      name,
      username,
      originUserId,
      platform,
      profilePictureURL,
      createdAt: new Date().toString(),
      updatedAt: new Date().toString(),
    });

    const {getKeyring, getHexPublicKey} = new PolkadotJs();
    const newKey = getKeyring(process.env.MYRIAD_CRYPTO_TYPE).addFromUri('//' + newPeople.id);

    this.peopleRepository.updateById(newPeople.id, {
      walletAddress: getHexPublicKey(newKey),
    }) as Promise<void>;

    return this.peopleRepository.userSocialMedia(newPeople.id).create({
      userId: publicKey,
      platform: platform,
      verified: true,
    });
  }
}
