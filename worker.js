import fs from 'fs';
import Queue from 'bull';
import imageThumbnail from 'image-thumbnail';
import { ObjectId } from 'mongodb';
import dbClient from './utils/db';

const THUMBNAIL_WIDTHS = [500, 250, 100];

const fileQueue = new Queue('fileQueue');

fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;

  if (!fileId) {
    throw new Error('Missing fileId');
  }
  if (!userId) {
    throw new Error('Missing userId');
  }

  const files = await dbClient.filesCollection();
  const file = (ObjectId.isValid(fileId) && ObjectId.isValid(userId))
    ? await files.findOne({ _id: new ObjectId(fileId), userId: new ObjectId(userId) })
    : null;
  if (!file) {
    throw new Error('File not found');
  }

  await Promise.all(THUMBNAIL_WIDTHS.map(async (width) => {
    const thumbnail = await imageThumbnail(file.localPath, { width });
    await fs.promises.writeFile(`${file.localPath}_${width}`, thumbnail);
  }));
});

export default fileQueue;
