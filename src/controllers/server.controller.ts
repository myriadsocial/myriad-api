import {AnyObject} from '@loopback/repository';
import {get} from '@loopback/rest';
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
    return {
      serverId: config.MYRIAD_SERVER_ID,
    };
  }
}
