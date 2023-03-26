import {authenticate} from '@loopback/authentication';
import {inject, service} from '@loopback/core';
import {
  post,
  Request,
  requestBody,
  Response,
  RestBindings,
} from '@loopback/rest';
import {VideoUploadService} from '../services/video-upload.service';

@authenticate('jwt')
export class VideoUploadController {
  constructor(
    @service(VideoUploadService)
    private videoUploadService: VideoUploadService,
  ) {}

  @post('/upload/vide', {
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
  async videoUpload(
    @requestBody.file()
    request: Request,
    @inject(RestBindings.Http.RESPONSE)
    response: Response,
  ) {
    return this.videoUploadService.uploadVideo(request, response);
  }
}
