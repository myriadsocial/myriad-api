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
import {config} from '../config';
import {UploadType} from '../enums';
import {authenticate} from '@loopback/authentication';
import {repository} from '@loopback/repository';
import {UserRepository} from '../repositories';

@authenticate('jwt')
export class StorageController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
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
          const targetDir = `users/${userId}/${kind}`;
          resolve(this.getFilesAndFields(targetDir, request));
        }
      });
    });
  }

  private async getFilesAndFields(targetDir: string, request: Request) {
    const uploadedFiles = request.files;
    const mapper = async (file: globalThis.Express.Multer.File) => {
      let fileURL: String = '';
      if (config.FIREBASE_STORAGE_BUCKET) {
        let uploadType = UploadType.IMAGE;
        if (file.mimetype.toLowerCase().startsWith('video')) {
          uploadType = UploadType.VIDEO;
        }

        fileURL = await this.fcsService.upload(
          uploadType,
          targetDir,
          file.path,
        );
      }

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
