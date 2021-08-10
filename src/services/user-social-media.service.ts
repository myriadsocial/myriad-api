import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {PlatformType} from '../enums';
import {ExtendedPeople} from '../interfaces';
import {UserSocialMedia} from '../models';
import {PeopleRepository, UserSocialMediaRepository} from '../repositories';
import {PolkadotJs} from '../utils/polkadotJs-utils';

export class UserSocialMediaService {
  constructor(
    @repository(UserSocialMediaRepository)
    protected userSocialMediaRepository: UserSocialMediaRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
  ) {}

  async createSocialMedia(people: ExtendedPeople): Promise<UserSocialMedia> {
    const {name, originUserId, username, platform, profilePictureURL, publicKey} = people;

    // Verify SocialMedia
    const userSocialMedia = await this.userSocialMediaRepository.findOne({
      where: {
        userId: publicKey,
        platform: platform as PlatformType,
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

    const foundPeople = await this.peopleRepository.findOne({
      where: {originUserId, platform},
    });

    if (foundPeople) {
      const peopleSocialMedia = await this.userSocialMediaRepository.findOne({
        where: {
          peopleId: people.id,
          platform: platform as PlatformType,
        },
      });

      if (!peopleSocialMedia) {
        return this.peopleRepository.userSocialMedia(foundPeople.id).create({
          userId: publicKey,
          platform: platform as PlatformType,
          verified: true,
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        });
      }

      if (peopleSocialMedia.userId === people.publicKey) {
        if (peopleSocialMedia.verified) {
          throw new HttpErrors.UnprocessableEntity('You already verified this social media');
        }

        peopleSocialMedia.verified = true;
        peopleSocialMedia.updatedAt = new Date().toString();
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
    const newKey = getKeyring().addFromUri('//' + newPeople.id);

    this.peopleRepository.updateById(newPeople.id, {
      walletAddress: getHexPublicKey(newKey),
    }) as Promise<void>;

    return this.peopleRepository.userSocialMedia(newPeople.id).create({
      userId: publicKey,
      platform: platform as PlatformType,
      verified: true,
    });
  }
}
