import {AnyObject, repository} from '@loopback/repository';
import {MigrationScript, migrationScript} from 'loopback4-migration';
import {PostImporterRepository, PostRepository} from '../repositories';
import {Post, PostImporter} from '../models';

/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  @typescript-eslint/naming-convention */
@migrationScript()
export class MigrationScript100 implements MigrationScript {
  version = '1.0.0';

  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(PostImporterRepository)
    protected postImporterRepository: PostImporterRepository,
  ) {}

  async up(): Promise<void> {
    await this.doMigratePosts();
    await this.doMigratePostImporter();
  }

  async doMigratePosts(): Promise<void> {
    const collection = (
      this.postRepository.dataSource.connector as any
    ).collection(Post.modelName);

    const posts = await collection.aggregate().get();

    await Promise.all(
      posts.map(async (post: AnyObject) => {
        if (post.importers && post.importers.length > 0) {
          const importers = post.importers;
          const postId = post._id;

          delete post._id;
          delete post.importers;

          await Promise.all(
            importers.map(async (importer: string) => {
              if (importer === post.createdBy) return null;

              post.createdBy = importer;

              const found = await this.postRepository.findOne({
                where: {
                  originPostId: post.originPostId,
                  platform: post.platform,
                  createdBy: post.createdBy,
                }
              })

              if (found) return null;

              return this.postRepository.create(post);
            }),
          );

          return collection.updateOne(
            {_id: postId},
            {
              $unset: {
                importers: '',
              },
            },
          );
        }

        return null;
      }),
    );
  }

  async doMigratePostImporter(): Promise<void> {
    const collection = (
      this.postImporterRepository.dataSource.connector as any
    ).collection(PostImporter.modelName);

    const postImporters = await collection.aggregate().get();

    await Promise.all(
      postImporters.map(async (postImporter: AnyObject) => {
        const postId = postImporter.postId;
        const importerId = postImporter.importerId;

        const post = (await this.postRepository.findOne({
          where: {
            id: postId,
          },
        })) as Partial<Post> | null;

        if (!post) return null;

        delete post.id;
        delete post.importers;

        post.createdBy = importerId;

        const found = await this.postRepository.findOne({
          where: {
            originPostId: post.originPostId,
            platform: post.platform,
            createdBy: post.createdBy,
          }
        });

        if (found) return null;

        return this.postRepository.create(post);
      }),
    );

    try {
      await collection.drop();
    } catch {
      // ignore
    }
  }
}
