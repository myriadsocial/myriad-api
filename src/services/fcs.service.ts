import {BindingScope, injectable} from '@loopback/core';
import {AnyObject} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import * as firebaseAdmin from 'firebase-admin';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import {config} from '../config';
import {UploadType} from '../enums';

@injectable({scope: BindingScope.TRANSIENT})
export class FCSService {
  constructor() {}

  async upload(
    type: UploadType,
    targetDir: string,
    filePath: string,
  ): Promise<String> {
    const bucket = config.FIREBASE_STORAGE_BUCKET
      ? firebaseAdmin.storage().bucket()
      : undefined;

    const tempDir = os.tmpdir();
    const baseName = path.parse(filePath).name;
    const extension = path.parse(filePath).ext;
    const {format, mutations} = this.getMutations(type);

    let result = '';
    for (const mutation of mutations) {
      let formattedFilePath = `${tempDir}/${baseName}${extension}`;
      let uploadFilePath = `${targetDir}/${baseName}${extension}`;

      if (type === UploadType.IMAGE) {
        formattedFilePath = `${tempDir}/${baseName}${mutation.suffix}_formatted.${format}`;
        uploadFilePath = `${targetDir}/${baseName}${mutation.suffix}.${format}`;

        if (mutation.type === 'origin') {
          await sharp(filePath)
            .withMetadata()
            .toFormat('jpg')
            .toFile(formattedFilePath);
        } else {
          await sharp(filePath)
            .resize({width: mutation.width})
            .withMetadata()
            .toFormat('jpg')
            .toFile(formattedFilePath);
        }
      }

      if (bucket) {
        const [file] = await bucket.upload(formattedFilePath, {
          resumable: false,
          public: true,
          destination: uploadFilePath,
        });
        result = file.publicUrl();
      } else {
        if (!config.STORAGE_URL) {
          fs.unlinkSync(filePath);
          fs.unlinkSync(formattedFilePath);
          throw new HttpErrors.UnprocessableEntity('Storage not found');
        }

        const folderPath = '../../storages';
        const tmpSubFolderPath = `${folderPath}/${targetDir}`;
        const tmpUpdatedFilePath = `${folderPath}/${uploadFilePath}`;
        const subfolderPath = path.join(__dirname, tmpSubFolderPath);
        const updatedFilePath = path.join(__dirname, tmpUpdatedFilePath);
        if (!fs.existsSync(subfolderPath)) {
          fs.mkdirSync(subfolderPath, {recursive: true});
        }

        fs.copyFileSync(formattedFilePath, updatedFilePath);
        result = `${config.STORAGE_URL}/${baseName}.${format}`;
      }

      if (type === UploadType.IMAGE) fs.unlinkSync(formattedFilePath);
    }

    fs.unlinkSync(filePath);

    return result;
  }

  getMutations(type: UploadType): AnyObject {
    if (type === UploadType.VIDEO) {
      return {
        format: 'mp4',
        mutations: [
          {
            type: 'origin',
            suffix: '',
            width: 0,
          },
        ],
      };
    }

    return {
      format: 'jpg',
      mutations: [
        {
          type: 'thumbnail',
          suffix: '_thumbnail',
          width: 200,
        },
        {
          type: 'small',
          suffix: '_small',
          width: 400,
        },
        {
          type: 'medium',
          suffix: '_medium',
          width: 600,
        },
        {
          type: 'origin',
          suffix: '',
          width: 0,
        },
      ],
    };
  }
}
