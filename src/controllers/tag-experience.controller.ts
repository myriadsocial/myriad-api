// import {
//   Count,
//   CountSchema,
//   Filter,
//   repository,
//   Where,
// } from '@loopback/repository';
//   import {
//   del,
//   get,
//   getModelSchemaRef,
//   getWhereSchemaFor,
//   param,
//   patch,
//   post,
//   requestBody,
// } from '@loopback/rest';
// import {
// Tag,
// SavedTag,
// Experience,
// } from '../models';
// import {TagRepository} from '../repositories';

// export class TagExperienceController {
//   constructor(
//     @repository(TagRepository) protected tagRepository: TagRepository,
//   ) { }

//   @get('/tags/{id}/experiences', {
//     responses: {
//       '200': {
//         description: 'Array of Tag has many Experience through SavedTag',
//         content: {
//           'application/json': {
//             schema: {type: 'array', items: getModelSchemaRef(Experience)},
//           },
//         },
//       },
//     },
//   })
//   async find(
//     @param.path.string('id') id: string,
//     @param.query.object('filter') filter?: Filter<Experience>,
//   ): Promise<Experience[]> {
//     return this.tagRepository.savedExperiences(id).find(filter);
//   }

//   @post('/tags/{id}/experiences', {
//     responses: {
//       '200': {
//         description: 'create a Experience model instance',
//         content: {'application/json': {schema: getModelSchemaRef(Experience)}},
//       },
//     },
//   })
//   async create(
//     @param.path.string('id') id: typeof Tag.prototype.id,
//     @requestBody({
//       content: {
//         'application/json': {
//           schema: getModelSchemaRef(Experience, {
//             title: 'NewExperienceInTag',
//             exclude: ['id'],
//           }),
//         },
//       },
//     }) experience: Omit<Experience, 'id'>,
//   ): Promise<Experience> {
//     return this.tagRepository.savedExperiences(id).create(experience);
//   }

//   @patch('/tags/{id}/experiences', {
//     responses: {
//       '200': {
//         description: 'Tag.Experience PATCH success count',
//         content: {'application/json': {schema: CountSchema}},
//       },
//     },
//   })
//   async patch(
//     @param.path.string('id') id: string,
//     @requestBody({
//       content: {
//         'application/json': {
//           schema: getModelSchemaRef(Experience, {partial: true}),
//         },
//       },
//     })
//     experience: Partial<Experience>,
//     @param.query.object('where', getWhereSchemaFor(Experience)) where?: Where<Experience>,
//   ): Promise<Count> {
//     return this.tagRepository.savedExperiences(id).patch(experience, where);
//   }

//   @del('/tags/{id}/experiences', {
//     responses: {
//       '200': {
//         description: 'Tag.Experience DELETE success count',
//         content: {'application/json': {schema: CountSchema}},
//       },
//     },
//   })
//   async delete(
//     @param.path.string('id') id: string,
//     @param.query.object('where', getWhereSchemaFor(Experience)) where?: Where<Experience>,
//   ): Promise<Count> {
//     return this.tagRepository.savedExperiences(id).delete(where);
//   }
// }
