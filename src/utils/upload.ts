import {AnyObject} from '@loopback/repository';
import {config} from '../config';
import {v4 as uuid} from 'uuid';
import * as firebaseAdmin from 'firebase-admin';
import sharp from 'sharp';
import fs, {existsSync} from 'fs';
import path from 'path';
import os from 'os';
import {UploadType} from '../enums';

export async function upload(
  type: UploadType,
  targetDir: string,
  filePath: string,
) {
  if (!filePath) return '';

  const bucket = config.FIREBASE_STORAGE_BUCKET
    ? firebaseAdmin.storage().bucket()
    : undefined;

  const tmpDir = os.tmpdir();
  const baseName = path.parse(filePath).name;
  const extension = path.parse(filePath).ext;
  const {format, mutations} = getMutations(UploadType.IMAGE);

  let result = '';
  for (const mutation of mutations) {
    let formattedFilePath = `${tmpDir}/${baseName}${extension}`;
    let uploadFilePath = `${targetDir}/${baseName}${extension}`;

    if (type === UploadType.IMAGE) {
      formattedFilePath = `${tmpDir}/${baseName}${mutation.suffix}_formatted.${format}`;
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
      const [imageFile] = await bucket.upload(formattedFilePath, {
        resumable: false,
        public: true,
        destination: uploadFilePath,
      });

      result = imageFile.publicUrl();
    } else {
      if (!config.STORAGE_URL) {
        fs.unlinkSync(filePath);
        fs.unlinkSync(formattedFilePath);
        throw new Error('Storage not found');
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

      result = `${config.STORAGE_URL}/storages/${uploadFilePath}`;
    }

    if (type === UploadType.IMAGE) fs.unlinkSync(formattedFilePath);
  }

  fs.unlinkSync(filePath);

  return result;
}

export function getFilePathFromSeedData(sourceImageFileName: string) {
  const assetPath = path.join(__dirname, `../../seed-data/assets`);

  if (!existsSync(assetPath)) return '';

  const files = fs.readdirSync(assetPath);
  const file = files.find(e => {
    const [imageFile] = e.split(/\.(jpeg|jpg|gif|png)$/);
    if (imageFile === sourceImageFileName) return true;
    return false;
  });

  if (!file) return '';

  const tmpDir = os.tmpdir();
  const extension = path.parse(file).ext;
  const sourceImagePath = `${assetPath}/${file}`;
  const targetImagePath = `${tmpDir}/${uuid()}${extension}`;

  fs.copyFileSync(sourceImagePath, targetImagePath);

  return targetImagePath;
}

function getMutations(type: UploadType): AnyObject {
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
