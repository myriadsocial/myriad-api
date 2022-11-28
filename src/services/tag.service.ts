import {BindingScope, injectable} from '@loopback/core';
import {Filter, repository} from '@loopback/repository';
import {Tag} from '../models';
import {PostRepository, TagRepository} from '../repositories';

@injectable({scope: BindingScope.TRANSIENT})
export class TagService {
  constructor(
    @repository(TagRepository)
    private tagRepository: TagRepository,
    @repository(PostRepository)
    private postRepository: PostRepository,
  ) {}

  public async find(filter?: Filter<Tag>): Promise<Tag[]> {
    return this.tagRepository.find(filter);
  }

  public async create(tags: string[], experience?: boolean): Promise<void> {
    for (const tag of tags) {
      try {
        await this.tagRepository.create({
          id: tag,
          count: experience ? 0 : 1,
        });
      } catch {
        if (experience) continue;
        const {count} = await this.postRepository.count({
          tags: {
            inq: [[tag]],
          },
          deletedAt: {exists: false},
        });

        await this.tagRepository.updateById(tag, {
          updatedAt: new Date().toString(),
          count: count,
        });
      }
    }
  }
}
