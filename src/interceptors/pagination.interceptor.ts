import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {repository, Where} from '@loopback/repository';
import {TimelineType} from '../enums';
import {noneStatusFiltering} from '../helpers/filter-utils';
import {pageMetadata} from '../helpers/page-metadata.utils';
import {
  PeopleRepository,
  PostRepository,
  TransactionHistoryRepository,
  TransactionRepository,
  UserRepository,
} from '../repositories';
import {ExperienceService, FriendService, TagService} from '../services';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: PaginationInterceptor.BINDING_KEY}})
export class PaginationInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${PaginationInterceptor.name}`;

  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(TransactionHistoryRepository)
    protected transactionHistoryRepository: TransactionHistoryRepository,
    @service(ExperienceService)
    protected experienceService: ExperienceService,
    @service(TagService)
    protected tagService: TagService,
    @service(FriendService)
    protected friendService: FriendService,
  ) {}

  /**
   * This method is used by LoopBack context to produce an interceptor function
   * for the binding.
   *
   * @returns An interceptor function
   */
  value() {
    return this.intercept.bind(this);
  }

  /**
   * The logic to intercept an invocation
   * @param invocationCtx - Invocation context
   * @param next - A function to invoke next interceptor or the target method
   */
  async intercept(invocationCtx: InvocationContext, next: () => ValueOrPromise<InvocationResult>) {
    try {
      const result = await next();
      const methodName = invocationCtx.methodName;

      switch (methodName) {
        case 'find': {
          let where = null;

          if (invocationCtx.args[1]) {
            if (invocationCtx.args[1].where) {
              where = invocationCtx.args[1].where;
            }
          }

          let countResult = {
            count: 0,
          };

          const className = invocationCtx.targetClass.name;

          switch (className) {
            case 'UserController':
              countResult = await this.userRepository.count(where);
              break;

            case 'PostController':
              countResult = await this.postRepository.count(where);
              break;

            case 'TransactionController':
              countResult = await this.transactionRepository.count(where);
              break;

            case 'ExperienceController':
              countResult = await this.experienceService.experienceRepository.count(where);
              break;

            case 'PeopleController':
              countResult = await this.peopleRepository.count(where);
              break;

            case 'TransactionHistoryController':
              countResult = await this.transactionHistoryRepository.count(where);
          }

          if (countResult.count === 0) {
            return {
              data: [],
              meta: {
                totalItemCount: 0,
                totalPageCount: 0,
                itemsPerPage: 0,
              },
            };
          }

          return {
            data: result,
            meta: pageMetadata(invocationCtx.args, countResult.count),
          };
        }

        case 'userTimeline': {
          const userId = invocationCtx.args[0];
          const sortBy = invocationCtx.args[1];

          let where = null;

          switch (sortBy) {
            case TimelineType.EXPERIENCE:
              where = await this.experienceService.filterByExperience(userId);
              break;

            case TimelineType.TRENDING:
              where = await this.tagService.filterByTrending();
              break;

            case TimelineType.FRIEND:
              where = await this.friendService.filterByFriends(userId);
              break;

            case TimelineType.ALL: {
              const approvedFriendIds = await this.friendService.getApprovedFriendIds(userId);
              const trendingTopics = await this.tagService.trendingTopics();

              const experience = await this.experienceService.getExperience(userId);
              const experienceTopics = experience ? noneStatusFiltering(experience.tags) : [];
              const experiencePersonIds = experience ? noneStatusFiltering(experience.people) : [];

              const friends = [...approvedFriendIds, userId];
              const topics = [...trendingTopics, ...experienceTopics];
              const personIds = experiencePersonIds;

              const joinTopics = topics.join('|');
              const regexTopic = new RegExp(joinTopics, 'i');

              if (!friends.length && !topics.length && !personIds.length) {
                where = null;
                break;
              }

              where = {
                or: [
                  {
                    tags: {
                      inq: topics,
                    },
                  },
                  {
                    title: regexTopic,
                  },
                  {
                    text: regexTopic,
                  },
                  {
                    peopleId: {
                      inq: personIds,
                    },
                  },
                  {
                    importBy: {
                      inq: friends,
                    },
                  },
                  {
                    walletAddress: {
                      inq: friends,
                    },
                  },
                ],
              };

              break;
            }
          }

          if (where) {
            const countResult = await this.postRepository.count(where);
            const args = [invocationCtx.args[2], invocationCtx.args[3]];

            return {
              data: result,
              meta: pageMetadata(args, countResult.count),
            };
          } else {
            return {
              data: [],
              meta: {
                totalItemCount: 0,
                totalPageCount: 0,
                itemsPerPage: 0,
              },
            };
          }
        }

        case 'userFriendList': {
          const [userId, page, filter] = invocationCtx.args;
          const friendIds = await this.friendService.getApprovedFriendIds(userId);

          const countResult = await this.userRepository.count({
            id: {
              inq: friendIds,
            },
          });

          if (!countResult.count) {
            return {
              data: [],
              meta: {
                totalItemCount: 0,
                totalPageCount: 0,
                itemsPerPage: 0,
              },
            };
          }

          const args = [page, filter];

          return {
            data: result,
            meta: pageMetadata(args, countResult.count),
          };
        }

        case 'search': {
          const [q, page, filter] = invocationCtx.args;

          if (!q)
            return {
              data: [],
              meta: {
                totalItemCount: 0,
                totalPageCount: 0,
                itemsPerPage: 0,
              },
            };

          const pattern = new RegExp('^' + q, 'i');
          const countResult = await this.experienceService.experienceRepository.count({
            name: pattern,
            origin: true,
          } as Where);

          const args = [page, filter];

          return {
            data: result,
            meta: pageMetadata(args, countResult.count),
          };
        }
      }

      return result;
    } catch (err) {
      // Add error handling logic here
      throw err;
    }
  }
}
