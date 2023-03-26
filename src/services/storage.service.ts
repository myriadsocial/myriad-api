import {AuthenticationBindings} from '@loopback/authentication';
import {BindingScope, inject, injectable} from '@loopback/core';
import {AnyObject} from '@loopback/repository';
import {HttpErrors, Request, Response} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {FILE_UPLOAD_SERVICE} from '../keys';
import {FileUploadHandler} from '../types';
import {upload, UploadType} from '../utils/upload';

@injectable({scope: BindingScope.TRANSIENT})
export class StorageService {
  constructor(
    @inject(FILE_UPLOAD_SERVICE)
    private handler: FileUploadHandler,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private currentUser: UserProfile,
  ) {}

  public async fileUpload(kind: string, request: Request, response: Response) {
    const userId = this.currentUser?.[securityId];

    if (!userId) {
      throw new HttpErrors.Unauthorized('UnknownUser');
    }

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
