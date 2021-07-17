import {service} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {Post, PublicMetric} from '../models';
import {
  CryptocurrencyRepository,
  ExperienceRepository,
  PeopleRepository,
  PostRepository,
  TransactionRepository,
  UserCredentialRepository,
} from '../repositories';
import {TagService, SocialMediaService, PostService} from '../services';
import {PlatformType} from '../enums';
import {PlatformPost} from '../models/platform-post.model';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class PostController {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(UserCredentialRepository)
    protected userCredentialRepository: UserCredentialRepository,
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
    @repository(CryptocurrencyRepository)
    protected cryptocurrencyRepository: CryptocurrencyRepository,
    @service(TagService)
    protected tagService: TagService,
    @service(SocialMediaService)
    protected socialMediaService: SocialMediaService,
    @service(PostService)
    protected postService: PostService,
  ) {}

  @post('/posts')
  @response(200, {
    description: 'Post model instance',
    content: {'application/json': {schema: getModelSchemaRef(Post)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['text', 'walletAddress'],
            properties: {
              text: {
                type: 'string',
              },
              tags: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              assets: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              walletAddress: {
                type: 'string',
              },
            },
          },
        },
      },
    })
    _post: Omit<Post, 'id'>,
  ): Promise<Post> {
    if (_post.assets && _post.assets.length > 0) {
      _post.hasMedia = true;
    }

    delete _post.platformUser;

    _post.createdAt = new Date().toString();
    _post.updatedAt = new Date().toString();
    _post.platformCreatedAt = new Date().toString();
    _post.platform = PlatformType.MYRIAD;

    const newPost = await this.postRepository.create(_post);

    this.postRepository
      .publicMetric(newPost.id)
      .create({}) as Promise<PublicMetric>;

    // TODO: move logic to tagService
    if (_post.tags.length > 0) {
      this.tagService.createTags(_post.tags) as Promise<void>;
    }

    return newPost;
  }

  @post('/posts/import')
  @response(200, {
    description: 'Post',
    content: {'application/json': {schema: getModelSchemaRef(Post)}},
  })
  async importURL(
    @requestBody({
      description: 'Import post',
      content: {
        'application/json': {
          schema: getModelSchemaRef(PlatformPost),
        },
      },
    })
    platformPost: PlatformPost,
  ): Promise<Post> {
    // Format twitter https://twitter.com/{userId}/status/{tweetId}
    // Format reddit https://www.reddit.com/{subreddit_name_prefixed}/comments/{postId}/{title}/
    // Format facebook https://facebook.com/{userId}/posts/{postId}
    const splitURL = platformPost.url.split('/');
    const checkPlatform = splitURL[2].toLowerCase().split('.');

    let platform: string;
    let textId: string;

    if (checkPlatform.length > 2) {
      platform = checkPlatform[1];
    } else {
      platform = checkPlatform[0];
    }

    if (
      platform === PlatformType.TWITTER ||
      platform === PlatformType.FACEBOOK
    ) {
      textId = splitURL[5];
    } else {
      textId = splitURL[6];
    }

    // TODO: move logic to postService
    return this.postService.getPostFromSocialMediaPost({
      platform: platform,
      textId: textId,
      username: splitURL[3],
      postTags: platformPost.tags ? platformPost.tags : [],
      importer: platformPost.importer,
    });
  }

  @get('/posts')
  @response(200, {
    description: 'Array of Post model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Post, {includeRelations: true}),
        },
      },
    },
  })
  async find(@param.filter(Post) filter?: Filter<Post>): Promise<Post[]> {
    return this.postRepository.find(filter);
  }

  @get('/posts/{id}')
  @response(200, {
    description: 'Post model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Post, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Post, {exclude: 'where'}) filter?: FilterExcludingWhere<Post>,
  ): Promise<Post> {
    return this.postRepository.findById(id, filter);
  }

  @patch('/posts/{id}')
  @response(204, {
    description: 'Post PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Post, {partial: true}),
        },
      },
    })
    _post: Post,
  ): Promise<void> {
    _post.updatedAt = new Date().toString();
    await this.postRepository.updateById(id, _post);
  }

  @del('/posts/{id}')
  @response(204, {
    description: 'Post DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.postRepository.deleteById(id);
  }

  // TODO: remove unused method and endpoint
}
