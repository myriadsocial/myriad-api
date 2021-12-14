import {BindingScope, injectable} from '@loopback/core';
import * as firebaseAdmin from 'firebase-admin';
import sharp from 'sharp';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import {unlinkSync} from 'fs';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

@injectable({scope: BindingScope.TRANSIENT})
export class FCSService {
  constructor() {}

  async uploadImage(
    userId: string,
    kind: string,
    filePath: string,
  ): Promise<String> {
    const mutations = [
      {
        type: 'thumbnail',
        width: 200,
        height: 200,
      },
      {
        type: 'small',
        width: 400,
        height: 400,
      },
      {
        type: 'medium',
        width: 600,
        height: 600,
      },
    ];

    const bucket = firebaseAdmin.storage().bucket();
    const options = {resumable: false, metadata: {contentType: 'image/jpg'}};

    const parsed = path.parse(filePath);
    const format = 'jpg';

    const buffer = await sharp(filePath).toBuffer();

    for (const mutation of mutations) {
      const file = bucket.file(
        `${userId}/${kind}/${parsed.name}_${mutation.type}.${format}`,
      );

      const resized = await sharp(buffer)
        .resize({width: mutation.width})
        .toFormat(format)
        .toBuffer({resolveWithObject: true});

      await file.save(resized.data, options);
      await file.makePublic();
    }

    const file = bucket.file(`${userId}/${kind}/${parsed.name}.${format}`);
    const resized = await sharp(buffer)
      .toFormat(format)
      .toBuffer({resolveWithObject: true});

    await file.save(resized.data, options);

    await file.makePublic();

    return file.publicUrl();
  }

  async uploadVideo(
    userId: string,
    kind: string,
    filePath: string,
  ): Promise<String> {
    const bucket = firebaseAdmin.storage().bucket();
    const options = {
      destination: `${userId}/${kind}`,
      resumable: false,
      metadata: {contentType: 'video/mp4'},
    };

    const parsed = path.parse(filePath);
    const format = 'mp4';

    const convertedFilePath = `/tmp/convert_${parsed.name}.${format}`;

    const result: string = await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .videoCodec('libx264')
        .audioCodec('libmp3lame')
        .format('mp4')
        .on('error', err => {
          reject(err);
        })
        .on('end', () => {
          resolve(convertedFilePath);
        })
        .saveToFile(convertedFilePath);
    });

    const [file] = await bucket.upload(result, options);

    unlinkSync(result);

    await file.makePublic();

    return file.publicUrl();
  }
}
