import {AnyObject} from '@loopback/repository';
import {get, HttpErrors} from '@loopback/rest';
import {config} from '../config';

export class ServerController {
  constructor() {}

  @get('/server', {
    responses: {
      200: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
            },
          },
        },
        description: 'ServerId',
      },
    },
  })
  async find(): Promise<AnyObject> {
    if (!config.MYRIAD_SERVER_ID) {
      throw new HttpErrors.NotFound('Server not found');
    }

    return {
      serverId: config.MYRIAD_SERVER_ID,
    };
  }
}
