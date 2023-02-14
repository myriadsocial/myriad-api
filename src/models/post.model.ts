import {belongsTo, hasMany, Model, model, property} from '@loopback/repository';
import {PlatformType, PostStatus, VisibilityType} from '../enums';
import {Metric} from '../interfaces';
import {UserWithRelations} from './';
import {Comment} from './comment.model';
import {EmbeddedURL} from './embedded-url.model';
import {ExperiencePost} from './experience-post.model';
import {Experience} from './experience.model';
import {MentionUser} from './mention-user.model';
import {People, PeopleWithRelations} from './people.model';
import {Transaction} from './transaction.model';
import {User} from './user.model';
import {Vote} from './vote.model';
import {ImportedPost} from './imported-post.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'posts',
    },
    indexes: {
      postIndex: {
        keys: {
          visibility: 1,
          createdBy: 1,
        },
      },
      originPostIndex: {
        keys: {
          originPostId: 1,
        },
      },
    },
    hiddenProperties: ['popularCount', 'rawText'],
  },
})
export class Post extends ImportedPost {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id: string;

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
    default: [],
  })
  tags: string[];

  @property({
    type: 'string',
    required: false,
    jsonSchema: {
      enum: Object.values(PlatformType),
    },
    default: PlatformType.MYRIAD,
  })
  platform: PlatformType;

  @property({
    type: 'string',
    required: false,
    jsonSchema: {
      minLength: 1,
    },
  })
  text: string;

  @property({
    type: 'string',
    required: false,
  })
  rawText?: string;

  @property({
    type: 'object',
    default: {
      upvotes: 0,
      downvotes: 0,
      discussions: 0,
      debates: 0,
      comments: 0,
      tips: 0,
    },
  })
  metric: Metric;

  @property({
    type: 'object',
    require: false,
  })
  embeddedURL?: EmbeddedURL;

  @property({
    type: 'boolean',
    require: false,
    default: false,
  })
  isNSFW: boolean;

  @property({
    type: 'string',
    require: false,
  })
  NSFWTag?: string;

  @property({
    type: 'string',
    required: false,
    default: VisibilityType.PUBLIC,
    jsonSchema: {
      enum: Object.values(VisibilityType),
    },
  })
  visibility: VisibilityType;

  @property({
    type: 'array',
    itemType: 'object',
    required: false,
    default: [],
  })
  mentions: MentionUser[];

  @property({
    type: 'array',
    itemType: 'string',
    default: [],
  })
  selectedUserIds: string[];

  @property({
    type: 'number',
    required: false,
    default: 0,
  })
  popularCount: number;

  @property({
    type: 'boolean',
    required: false,
    default: false,
  })
  banned: boolean;

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  originCreatedAt?: string;

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  createdAt?: string;

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  updatedAt?: string;

  @property({
    type: 'date',
    required: false,
  })
  deletedAt?: string;

  @property({
    type: 'number',
    required: false,
  })
  totalExperience?: number;

  @belongsTo(() => User, {name: 'user'}, {required: true})
  createdBy: string;

  @belongsTo(() => People)
  peopleId: string;

  @hasMany(() => Comment, {keyTo: 'referenceId'})
  comments: Comment[];

  @hasMany(() => Vote, {keyTo: 'referenceId'})
  votes: Vote[];

  @hasMany(() => Transaction, {keyTo: 'referenceId'})
  transactions: Transaction[];

  @hasMany(() => Experience, {through: {model: () => ExperiencePost}})
  experiences: Experience[];

  constructor(data?: Partial<Post>) {
    super(data);
  }
}

export interface PostRelations {
  // describe navigational properties here
  people?: PeopleWithRelations;
  user?: UserWithRelations;
}

interface AdditionalProps {
  importers?: User[];
  totalImporter?: number;
}

export type PostWithRelations = Post & PostRelations & AdditionalProps;

export type ExtendedPost = PostWithRelations & {
  platformUser?: Omit<People, 'id'>;
};

export class PostDetail extends Model {
  @property({
    type: 'array',
    itemType: 'string',
    required: false,
    default: [],
  })
  tags: string[];

  @property({
    type: 'string',
    required: false,
    jsonSchema: {
      minLength: 1,
    },
  })
  text: string;

  @property({
    type: 'string',
    required: false,
  })
  rawText?: string;

  @property({
    type: 'object',
    require: false,
  })
  embeddedURL?: EmbeddedURL;

  @property({
    type: 'boolean',
    require: false,
    default: false,
  })
  isNSFW?: boolean;

  @property({
    type: 'string',
    require: false,
  })
  NSFWTag?: string;

  @property({
    type: 'string',
    required: false,
    default: VisibilityType.PUBLIC,
    jsonSchema: {
      enum: Object.values(VisibilityType),
    },
  })
  visibility?: VisibilityType;

  @property({
    type: 'array',
    itemType: 'object',
    required: false,
    default: [],
  })
  mentions: MentionUser[];

  @property({
    type: 'array',
    itemType: 'string',
    default: [],
  })
  selectedUserIds?: string[];

  constructor(data?: Partial<PostDetail>) {
    super(data);
  }
}

export class PostDetailWithCreator extends PostDetail {
  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: Object.values(PlatformType),
    },
  })
  platform: PlatformType;

  @property({
    type: 'string',
    required: true,
  })
  createdBy: string;
}

export class DraftPost extends PostDetailWithCreator {
  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: Object.values(PostStatus),
    },
  })
  status: PostStatus;

  constructor(data?: Partial<DraftPost>) {
    super(data);
  }
}

export class UpdatePostDto extends PostDetail {
  constructor(data?: Partial<UpdatePostDto>) {
    super(data);
  }
}
