import {BindingScope, injectable} from '@loopback/core';
import * as firebaseAdmin from 'firebase-admin';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import {UploadType} from '../enums';

@injectable({scope: BindingScope.TRANSIENT})
export class FCSService {
  constructor() {}

  async upload(
    type: UploadType,
    targetDir: string,
    filePath: string,
  ): Promise<String> {
    const bucket = firebaseAdmin.storage().bucket();
    const tempDir = os.tmpdir();
    const baseName = path.parse(filePath).name;
    const extension = path.parse(filePath).ext;
    let format = 'jpg';
    let mutations = [
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
    ];

    if (type === UploadType.VIDEO) {
      format = 'mp4';
      mutations = [
        {
          type: 'origin',
          suffix: '',
          width: 0,
        },
      ];
    }

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

      const [file] = await bucket.upload(formattedFilePath, {
        resumable: false,
        public: true,
        destination: uploadFilePath,
      });
      result = file.publicUrl();

      if (type === UploadType.IMAGE) fs.unlinkSync(formattedFilePath);
    }

    fs.unlinkSync(filePath);

    return result;
  }
}
