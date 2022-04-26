import {AnyObject} from '@loopback/repository';
import {config} from '../config';
import {v4 as uuid} from 'uuid';
import * as firebaseAdmin from 'firebase-admin';
import sharp from 'sharp';
import fs, {existsSync} from 'fs';
import path from 'path';
import os from 'os';

export async function upload(data: AnyObject, name: string) {
  const assetPath = path.join(__dirname, `../../seed-data/assets`);

  if (!existsSync(assetPath)) return '';

  const files = fs.readdirSync(assetPath);
  const file = files.find(e => {
    const [imageFile] = e.split(/\.(jpeg|jpg|gif|png)$/);
    if (imageFile === data.imageFileName) return true;
    return false;
  });

  if (!file) return '';

  const bucket = config.FIREBASE_STORAGE_BUCKET
    ? firebaseAdmin.storage().bucket()
    : undefined;

  const baseName = uuid();
  const tmpDir = os.tmpdir();
  const filePath = `${assetPath}/${file}`;
  const format = 'jpg';
  const mutations = [
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

  let result = '';
  for (const mutation of mutations) {
    const formattedFilePath = `${tmpDir}/${baseName}${mutation.suffix}_formatted.${format}`;
    const uploadFilePath = `${data.imagePath}/${name}/${baseName}${mutation.suffix}.${format}`;

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

    if (bucket) {
      const [imageFile] = await bucket.upload(formattedFilePath, {
        resumable: false,
        public: true,
        destination: uploadFilePath,
      });

      result = imageFile.publicUrl();
    } else {
      if (!config.STORAGE_URL) {
        fs.unlinkSync(formattedFilePath);
        throw new Error('Storage Not Found');
      }

      const folderPath = `../../storages/${data.imagePath}/${name}`;
      const storagePath = path.join(__dirname, `${folderPath}`);

      if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, {recursive: true});
      }

      fs.copyFileSync(
        formattedFilePath,
        `${storagePath}/${baseName}${mutation.suffix}.${format}`,
      );

      result = `${config.STORAGE_URL}/storages/${uploadFilePath}`;
    }

    fs.unlinkSync(formattedFilePath);
  }

  return result;
}
