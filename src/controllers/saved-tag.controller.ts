// import {
//   Count,
//   CountSchema,
//   Filter,
//   FilterExcludingWhere,
//   repository,
//   Where,
// } from '@loopback/repository';
// import {
//   post,
//   param,
//   get,
//   getModelSchemaRef,
//   patch,
//   put,
//   del,
//   requestBody,
//   response,
// } from '@loopback/rest';
// import {SavedTag} from '../models';
// import {SavedTagRepository} from '../repositories';

// export class SavedTagController {
//   constructor(
//     @repository(SavedTagRepository)
//     public savedTagRepository : SavedTagRepository,
//   ) {}

//   @post('/saved-tags')
//   @response(200, {
//     description: 'SavedTag model instance',
//     content: {'application/json': {schema: getModelSchemaRef(SavedTag)}},
//   })
//   async create(
//     @requestBody({
//       content: {
//         'application/json': {
//           schema: getModelSchemaRef(SavedTag, {
//             title: 'NewSavedTag',
            
//           }),
//         },
//       },
//     })
//     savedTag: SavedTag,
//   ): Promise<SavedTag> {
//     return this.savedTagRepository.create(savedTag);
//   }

//   @get('/saved-tags/count')
//   @response(200, {
//     description: 'SavedTag model count',
//     content: {'application/json': {schema: CountSchema}},
//   })
//   async count(
//     @param.where(SavedTag) where?: Where<SavedTag>,
//   ): Promise<Count> {
//     return this.savedTagRepository.count(where);
//   }

//   @get('/saved-tags')
//   @response(200, {
//     description: 'Array of SavedTag model instances',
//     content: {
//       'application/json': {
//         schema: {
//           type: 'array',
//           items: getModelSchemaRef(SavedTag, {includeRelations: true}),
//         },
//       },
//     },
//   })
//   async find(
//     @param.filter(SavedTag) filter?: Filter<SavedTag>,
//   ): Promise<SavedTag[]> {
//     return this.savedTagRepository.find(filter);
//   }

//   @patch('/saved-tags')
//   @response(200, {
//     description: 'SavedTag PATCH success count',
//     content: {'application/json': {schema: CountSchema}},
//   })
//   async updateAll(
//     @requestBody({
//       content: {
//         'application/json': {
//           schema: getModelSchemaRef(SavedTag, {partial: true}),
//         },
//       },
//     })
//     savedTag: SavedTag,
//     @param.where(SavedTag) where?: Where<SavedTag>,
//   ): Promise<Count> {
//     return this.savedTagRepository.updateAll(savedTag, where);
//   }

//   @get('/saved-tags/{id}')
//   @response(200, {
//     description: 'SavedTag model instance',
//     content: {
//       'application/json': {
//         schema: getModelSchemaRef(SavedTag, {includeRelations: true}),
//       },
//     },
//   })
//   async findById(
//     @param.path.string('id') id: string,
//     @param.filter(SavedTag, {exclude: 'where'}) filter?: FilterExcludingWhere<SavedTag>
//   ): Promise<SavedTag> {
//     return this.savedTagRepository.findById(id, filter);
//   }

//   @patch('/saved-tags/{id}')
//   @response(204, {
//     description: 'SavedTag PATCH success',
//   })
//   async updateById(
//     @param.path.string('id') id: string,
//     @requestBody({
//       content: {
//         'application/json': {
//           schema: getModelSchemaRef(SavedTag, {partial: true}),
//         },
//       },
//     })
//     savedTag: SavedTag,
//   ): Promise<void> {
//     await this.savedTagRepository.updateById(id, savedTag);
//   }

//   @put('/saved-tags/{id}')
//   @response(204, {
//     description: 'SavedTag PUT success',
//   })
//   async replaceById(
//     @param.path.string('id') id: string,
//     @requestBody() savedTag: SavedTag,
//   ): Promise<void> {
//     await this.savedTagRepository.replaceById(id, savedTag);
//   }

//   @del('/saved-tags/{id}')
//   @response(204, {
//     description: 'SavedTag DELETE success',
//   })
//   async deleteById(@param.path.string('id') id: string): Promise<void> {
//     await this.savedTagRepository.deleteById(id);
//   }
// }
