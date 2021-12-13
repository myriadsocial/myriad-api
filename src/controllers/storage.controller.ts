import {inject, service} from '@loopback/core';
import {
  post,
  requestBody,
  Request,
  Response,
  RestBindings,
  param,
} from '@loopback/rest';
import {FCSService} from '../services/fcs.service';
import {FILE_UPLOAD_SERVICE} from '../keys';
import {FileUploadHandler} from '../types';
import {unlinkSync} from 'fs';
import {config} from '../config';

export class StorageController {
  constructor(
    @inject(FILE_UPLOAD_SERVICE)
    private handler: FileUploadHandler,
    @service(FCSService)
    private fcsService: FCSService,
  ) {}

  @post('/buckets/{userId}/{kind}', {
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
    @param.path.string('userId') userId: string,
    @param.path.string('kind') kind: string,
    @requestBody.file() request: Request,
    @inject(RestBindings.Http.RESPONSE) response: Response,
  ): Promise<object> {
    return new Promise<object>((resolve, reject) => {
      this.handler(request, response, (err: unknown) => {
        if (err) reject(err);
        else {
          resolve(this.getFilesAndFields(userId, kind, request));
        }
      });
    });
  }

  /**
   * Get files and fields for the request
   * @param request - Http request
   */
  private async getFilesAndFields(
    userId: string,
    kind: string,
    request: Request,
  ) {
    const uploadedFiles = request.files;
    const mapper = async (f: globalThis.Express.Multer.File) => {
      let downloadURL: String = '';
      if (config.FIREBAE_STORAGE_BUCKET) {
        if (f.mimetype.toLowerCase().startsWith('image')) {
          downloadURL = await this.fcsService.uploadImage(userId, kind, f.path);
        } else {
          downloadURL = await this.fcsService.uploadVideo(userId, kind, f.path);
        }

        unlinkSync(f.path);
      }

      return {
        fieldname: f.fieldname,
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        url: downloadURL,
      };
    };
    let files: object[] = [];
    if (Array.isArray(uploadedFiles)) {
      files = await Promise.all(uploadedFiles.map(mapper));
    } else {
      for (const filename in uploadedFiles) {
        const result = (files = await Promise.all(
          uploadedFiles[filename].map(mapper),
        ));
        files.push(...result);
      }
    }
    return {files, fields: request.body};
  }
}
