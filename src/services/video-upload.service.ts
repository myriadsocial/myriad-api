import {AuthenticationBindings} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {HttpErrors, Request, Response} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {FILE_UPLOAD_SERVICE} from '../keys';
import {FileUploadHandler} from '../types';
import {upload, UploadType} from '../utils/upload';

export class VideoUploadService {
  private mimeTypes = [
    'video/x-flv',
    'video/mp4',
    'application/x-mpegURL',
    'video/MP2T',
    'video/3gpp',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv',
  ];

  constructor(
    @inject(FILE_UPLOAD_SERVICE)
    private handler: FileUploadHandler,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private currentUser: UserProfile,
  ) {}

  async uploadVideo(request: Request, response: Response) {
    const userId = this.currentUser[securityId];

    if (!userId) {
      throw new HttpErrors[401]();
    }

    return new Promise<object>((resolve, reject) => {
      this.handler(request, response, err => {
        if (err) reject(err);
        else {
          resolve(this.getFilesAndFields(userId, request));
        }
      });
    });
  }

  async getFilesAndFields(userId: string, request: Request) {
    const uploadedFiles = request.files;
    const mapper = async (file: globalThis.Express.Multer.File) => {
      if (!this.mimeTypes.includes(file.mimetype)) {
        throw new HttpErrors[415]();
      }

      const targetDir = `/users/${userId}/video`;
      const fileURL = await upload(UploadType.VIDEO, targetDir, file.path);

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
        const listFileUploaded = await Promise.all(
          uploadedFiles[filename].map(mapper),
        );
        files.push(...listFileUploaded);
      }
    }

    return {
      files,
      fields: request.body,
    };
  }
}
