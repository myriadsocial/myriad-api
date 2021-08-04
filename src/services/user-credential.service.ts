import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {ExtendedUser} from '../interfaces';
import {UserCredential} from '../models';
import {PeopleRepository, UserCredentialRepository} from '../repositories';

export class UserCredentialService {
  constructor(
    @repository(UserCredentialRepository)
    public userCredentialRepository: UserCredentialRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
  ) {}

  async createCredential(user: ExtendedUser): Promise<UserCredential> {
    const {name, platformAccountId, username, platform, profileImageURL, publicKey} = user;

    // Verify credential
    const foundPlatformCredential = await this.userCredentialRepository.findOne({
      where: {
        userId: publicKey,
        platform: platform,
      },
    });

    if (foundPlatformCredential) {
      const person = await this.peopleRepository.findOne({
        where: {
          id: foundPlatformCredential.peopleId,
        },
      });

      if (person && person.platformAccountId !== platformAccountId) {
        throw new HttpErrors.NotFound(`This ${person.platform} does not belong to you!`);
      }
    }

    const foundPeople = await this.peopleRepository.findOne({
      where: {platformAccountId, platform},
    });

    if (foundPeople) {
      const foundCredential = await this.userCredentialRepository.findOne({
        where: {
          peopleId: foundPeople.id,
          platform: platform,
        },
      });

      if (!foundCredential) {
        return this.peopleRepository.userCredential(foundPeople.id).create({
          userId: publicKey,
          platform: platform,
          isVerified: true,
        });
      }

      if (foundCredential.userId === user.publicKey) {
        if (foundCredential.isVerified) {
          throw new HttpErrors.UnprocessableEntity('You already verified this account');
        }

        foundCredential.isVerified = true;
        this.userCredentialRepository.updateById(
          foundCredential.id,
          foundCredential,
        ) as Promise<void>;

        return foundCredential;
      }

      throw new HttpErrors.NotFound('Credential Invalid');
    }

    const newPeople = await this.peopleRepository.create({
      name,
      username,
      platformAccountId,
      platform,
      profileImageURL,
    });

    return this.peopleRepository.userCredential(newPeople.id).create({
      userId: publicKey,
      platform: platform,
      isVerified: true,
    });
  }
}
