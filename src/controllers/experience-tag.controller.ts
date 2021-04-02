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
// Experience,
// SavedTag,
// Tag,
// } from '../models';
// import {ExperienceRepository} from '../repositories';

// export class ExperienceTagController {
//   constructor(
//     @repository(ExperienceRepository) protected experienceRepository: ExperienceRepository,
//   ) { }

//   @get('/experiences/{id}/tags', {
//     responses: {
//       '200': {
//         description: 'Array of Experience has many Tag through SavedTag',
//         content: {
//           'application/json': {
//             schema: {type: 'array', items: getModelSchemaRef(Tag)},
//           },
//         },
//       },
//     },
//   })
//   async find(
//     @param.path.string('id') id: string,
//     @param.query.object('filter') filter?: Filter<Tag>,
//   ): Promise<Tag[]> {
//     return this.experienceRepository.savedTags(id).find(filter);
//   }

//   @post('/experiences/{id}/tags', {
//     responses: {
//       '200': {
//         description: 'create a Tag model instance',
//         content: {'application/json': {schema: getModelSchemaRef(Tag)}},
//       },
//     },
//   })
//   async create(
//     @param.path.string('id') id: typeof Experience.prototype.id,
//     @requestBody({
//       content: {
//         'application/json': {
//           schema: getModelSchemaRef(Tag, {
//             title: 'NewTagInExperience',
//           }),
//         },
//       },
//     }) tag: Omit<Tag, 'id'>,
//   ): Promise<Tag> {
//     return this.experienceRepository.savedTags(id).create(tag);
//   }

//   @patch('/experiences/{id}/tags', {
//     responses: {
//       '200': {
//         description: 'Experience.Tag PATCH success count',
//         content: {'application/json': {schema: CountSchema}},
//       },
//     },
//   })
//   async patch(
//     @param.path.string('id') id: string,
//     @requestBody({
//       content: {
//         'application/json': {
//           schema: getModelSchemaRef(Tag, {partial: true}),
//         },
//       },
//     })
//     tag: Partial<Tag>,
//     @param.query.object('where', getWhereSchemaFor(Tag)) where?: Where<Tag>,
//   ): Promise<Count> {
//     return this.experienceRepository.savedTags(id).patch(tag, where);
//   }

//   @del('/experiences/{id}/tags', {
//     responses: {
//       '200': {
//         description: 'Experience.Tag DELETE success count',
//         content: {'application/json': {schema: CountSchema}},
//       },
//     },
//   })
//   async delete(
//     @param.path.string('id') id: string,
//     @param.query.object('where', getWhereSchemaFor(Tag)) where?: Where<Tag>,
//   ): Promise<Count> {
//     return this.experienceRepository.savedTags(id).delete(where);
//   }
// }
