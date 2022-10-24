import {AuthenticationBindings} from '@loopback/authentication';
import {BindingScope, inject, injectable, service} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {securityId, UserProfile} from '@loopback/security';
import {orderBy, pull} from 'lodash';
import {FriendStatusType, PlatformType} from '../enums';
import {People} from '../models';
import {PeopleRepository, UserRepository} from '../repositories';
import {FriendService} from './friend.service';

@injectable({scope: BindingScope.TRANSIENT})
export class PeopleService {
  constructor(
    @repository(PeopleRepository)
    private peopleRepository: PeopleRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
    @service(FriendService)
    private friendService: FriendService,
    @inject(AuthenticationBindings.CURRENT_USER)
    private currentUser: UserProfile,
  ) {}

  public async search(q?: string): Promise<People[]> {
    if (!q) return [];
    const pattern = new RegExp('^' + q, 'i');

    return this.friendService
      .getFriendIds(
        this.currentUser[securityId],
        FriendStatusType.BLOCKED,
        true,
      )
      .then(blockedIds => {
        return Promise.all([
          this.userRepository.find(<AnyObject>{
            where: {
              id: {nin: blockedIds},
              or: [
                {
                  name: {
                    regexp: pattern,
                  },
                },
                {
                  username: {
                    regexp: pattern,
                  },
                },
              ],
              deletedAt: {
                $eq: null,
              },
            },
            order: ['createdAt DESC'],
            limit: 10,
          }),
          this.peopleRepository.find(<AnyObject>{
            where: {
              or: [
                {
                  name: {
                    regexp: pattern,
                  },
                },
                {
                  username: {
                    regexp: pattern,
                  },
                },
              ],
              deletedAt: {
                $eq: null,
              },
            },
            include: ['userSocialMedia'],
            order: ['createdAt DESC'],
            limit: 10,
          }),
        ]);
      })
      .then(([users, p]) => {
        const userToPeople = pull(users).map(user => {
          return new People({
            id: user.id,
            name: user.name,
            username: user.username,
            platform: PlatformType.MYRIAD,
            originUserId: user.id,
            profilePictureURL: user.profilePictureURL,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          });
        });

        return orderBy([...userToPeople, ...p], ['createdAt'], ['desc']);
      })
      .catch(err => {
        throw err;
      });
  }
}
