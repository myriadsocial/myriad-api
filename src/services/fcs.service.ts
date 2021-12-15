import {BindingScope, injectable} from '@loopback/core';
import * as firebaseAdmin from 'firebase-admin';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import {UploadType} from '../enums';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

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
      const formattedFilePath = `${tempDir}/${baseName}${mutation.suffix}_formatted.${format}`;
      const uploadFilePath = `${targetDir}/${baseName}${mutation.suffix}.${format}`;

      if (mutation.type === 'origin') {
        if (type === UploadType.IMAGE) {
          await sharp(filePath)
            .toFormat('jpg')
            .toFile(formattedFilePath);
        } else {
          await new Promise((resolve, reject) => {
            ffmpeg(filePath)
              .videoCodec('libx264')
              .audioCodec('libmp3lame')
              .format('mp4')
              .on('error', err => {
                reject(err);
              })
              .on('end', () => {
                resolve(formattedFilePath);
              })
              .saveToFile(formattedFilePath);
          });
        }
      } else {
        if (type === UploadType.IMAGE) {
          await sharp(filePath)
            .resize({width: mutation.width})
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

      fs.unlinkSync(formattedFilePath);
    }

    fs.unlinkSync(filePath);

    return result;
  }
}
