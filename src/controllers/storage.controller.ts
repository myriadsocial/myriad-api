import {authenticate} from '@loopback/authentication';
import {inject, service} from '@loopback/core';
import {AnyObject} from '@loopback/repository';
import {
  param,
  post,
  Request,
  requestBody,
  Response,
  RestBindings,
} from '@loopback/rest';
import {StorageService} from '../services';

@authenticate('jwt')
export class StorageController {
  constructor(
    @service(StorageService)
    private storageService: StorageService,
  ) {}

  @post('/buckets/{kind}', {
    responses: {
      200: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
            },
          },
        },
        description: 'Files and fields',
      },
    },
  })
  async fileUpload(
    @param.path.string('kind') kind: string,
    @requestBody.file() request: Request,
    @inject(RestBindings.Http.RESPONSE) response: Response,
  ): Promise<AnyObject> {
    return this.storageService.fileUpload(kind, request, response);
  }
}
