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

    const foundPeople = await this.peopleRepository.findOne({
      where: {
        originUserId: originUserId,
        platform: platform,
      },
    });

    if (!foundPeople) {
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
        createdAt: new Date().toString(),
        updatedAt: new Date().toString(),
      });
    }

    const userSocialMedia = await this.userSocialMediaRepository.findOne({
      where: {
        peopleId: people.id,
        platform: platform as PlatformType,
      },
    });

    if (userSocialMedia) {
      if (userSocialMedia.userId !== publicKey) {
        throw new HttpErrors.UnprocessableEntity(`Another user already claim this ${platform}!`);
      }

      if (userSocialMedia.verified) {
        throw new HttpErrors.UnprocessableEntity('You already verified this social media');
      }

      userSocialMedia.verified = true;
      userSocialMedia.updatedAt = new Date().toString();

      this.userSocialMediaRepository.updateById(
        userSocialMedia.id,
        userSocialMedia,
      ) as Promise<void>;

      return userSocialMedia;
    }

    const result = await this.userSocialMediaRepository.findOne({
      where: {
        userId: publicKey,
        platform: platform as PlatformType,
      },
    });

    if (result)
      throw new HttpErrors.UnprocessableEntity(
        `You already claimed another ${platform}. If you want to change to another ${platform}. Please disconnect then reconnect again!`,
      );

    return this.peopleRepository.userSocialMedia(foundPeople.id).create({
      userId: publicKey,
      platform: platform as PlatformType,
      verified: true,
      createdAt: new Date().toString(),
      updatedAt: new Date().toString(),
    });
  }
}
