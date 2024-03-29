import {AnyObject} from '@loopback/repository';
import fs, {existsSync} from 'fs';
import os from 'os';
import path from 'path';
import sharp, {FormatEnum} from 'sharp';
import {v4 as uuid} from 'uuid';
import {config} from '../config';
import {Client as MinioClient} from 'minio';

const minioClient = new MinioClient({
  endPoint: config.MINIO_ENDPOINT,
  port: config.MINIO_PORT,
  useSSL: false,
  accessKey: config.MINIO_ACCESS_KEY,
  secretKey: config.MINIO_SECRET_KEY,
});

export enum UploadType {
  IMAGE = 'image',
  VIDEO = 'video',
}

export async function upload(
  type: UploadType,
  targetDir: string,
  filePath: string,
) {
  if (!filePath) return '';

  const tmpDir = os.tmpdir();
  const baseName = path.parse(filePath).name;
  const extension = path.parse(filePath).ext;
  const {format, mutations} = getMutations(
    UploadType.IMAGE,
    extension.substring(1),
  );

  let result = '';
  for (const mutation of mutations) {
    let formattedFilePath = `${tmpDir}/${baseName}${extension}`;
    let uploadFilePath = `${targetDir}/${baseName}${extension}`;

    if (type === UploadType.IMAGE) {
      const suffix = format === 'svg' ? '' : mutation.suffix;

      formattedFilePath = `${tmpDir}/${baseName}${suffix}_formatted.${format}`;
      uploadFilePath = `${targetDir}/${baseName}${suffix}.${format}`;

      if (format === 'svg') {
        fs.copyFileSync(filePath, formattedFilePath);
      } else {
        if (mutation.type === 'origin') {
          await sharp(filePath)
            .withMetadata()
            .toFormat(format as keyof FormatEnum)
            .toFile(formattedFilePath);
        } else {
          await sharp(filePath)
            .resize({width: mutation.width})
            .withMetadata()
            .toFormat(format as keyof FormatEnum)
            .toFile(formattedFilePath);
        }
      }
    }

    if (minioClient) {
      try {
        const bucketName = config.MINIO_BUCKET_NAME;
        const objectName = uploadFilePath;
        await minioClient.fPutObject(bucketName, objectName, formattedFilePath);
        const url = `${config.MINIO_URL}/${objectName}`;
        result = url;
      } catch (error) {
        console.error(error);
        if (!config.DOMAIN) {
          fs.unlinkSync(filePath);
          fs.unlinkSync(formattedFilePath);
          throw new Error('Storage not found');
        }

        const folderPath = `../../storages`;
        const tmpSubFolderPath = `${folderPath}/${targetDir}`;
        const tmpUpdatedFilePath = `${folderPath}/${uploadFilePath}`;
        const subfolderPath = path.join(__dirname, tmpSubFolderPath);
        const updatedFilePath = path.join(__dirname, tmpUpdatedFilePath);
        if (!fs.existsSync(subfolderPath)) {
          fs.mkdirSync(subfolderPath, {recursive: true});
        }

        fs.copyFileSync(formattedFilePath, updatedFilePath);

        result = `https://${config.DOMAIN}/storages/${uploadFilePath}`;
      }
    } else {
      if (!config.DOMAIN) {
        fs.unlinkSync(filePath);
        fs.unlinkSync(formattedFilePath);
        throw new Error('Storage not found');
      }

      const folderPath = `../../storages`;
      const tmpSubFolderPath = `${folderPath}/${targetDir}`;
      const tmpUpdatedFilePath = `${folderPath}/${uploadFilePath}`;
      const subfolderPath = path.join(__dirname, tmpSubFolderPath);
      const updatedFilePath = path.join(__dirname, tmpUpdatedFilePath);
      if (!fs.existsSync(subfolderPath)) {
        fs.mkdirSync(subfolderPath, {recursive: true});
      }

      fs.copyFileSync(formattedFilePath, updatedFilePath);

      result = `https://${config.DOMAIN}/storages/${uploadFilePath}`;
    }

    if (type === UploadType.IMAGE) fs.unlinkSync(formattedFilePath);
    if (format === 'svg') break;
  }

  fs.unlinkSync(filePath);

  return result;
}

export function getFilePathFromSeedData(sourceImageFileName: string) {
  const assetPath = path.join(__dirname, `../../seed-data/assets`);
  if (!existsSync(assetPath)) return '';

  const files = fs.readdirSync(assetPath);
  const file = files.find(e => {
    const [imageFile] = e.split(/\.(jpeg|jpg|gif|png|svg)$/);
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

function getMutations(type: UploadType, extension = 'jpg'): AnyObject {
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
    format: extension,
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
