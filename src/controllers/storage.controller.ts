import {inject} from '@loopback/core';
import {
  post,
  requestBody,
  Request,
  Response,
  RestBindings,
  param,
} from '@loopback/rest';
import {FILE_UPLOAD_SERVICE} from '../keys';
import {FileUploadHandler} from '../types';
import {UploadType} from '../enums';
import {authenticate} from '@loopback/authentication';
import {AnyObject} from '@loopback/repository';
import {upload} from '../utils/upload';

@authenticate('jwt')
export class StorageController {
  constructor(
    @inject(FILE_UPLOAD_SERVICE)
    private handler: FileUploadHandler,
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
  ): Promise<AnyObject> {
    return new Promise<AnyObject>((resolve, reject) => {
      this.handler(request, response, (err: unknown) => {
        if (err) {
          reject(err);
        } else {
          const targetDir = `users/${userId}/${kind}`;
          resolve(this.getFilesAndFields(targetDir, request));
        }
      });
    });
  }

  private async getFilesAndFields(targetDir: string, request: Request) {
    const uploadedFiles = request.files;
    const mapper = async (file: globalThis.Express.Multer.File) => {
      let uploadType = UploadType.IMAGE;
      if (file.mimetype.toLowerCase().startsWith('video')) {
        uploadType = UploadType.VIDEO;
      }

      const fileURL = await upload(uploadType, targetDir, file.path);

      return {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: fileURL,
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
