import fs from 'fs';
import path from 'path';
import Queue from 'bull';
import mime from 'mime-types';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import { getUserFromToken } from '../utils/auth';

const ACCEPTED_TYPES = ['folder', 'file', 'image'];
const THUMBNAIL_SIZES = ['500', '250', '100'];
const PAGE_SIZE = 20;
const ROOT_ID = 0;

const fileQueue = new Queue('fileQueue');

/**
 * Formats a file document for the API response.
 * @param {object} file
 */
const formatFile = (file) => ({
  id: file._id.toString(),
  userId: file.userId.toString(),
  name: file.name,
  type: file.type,
  isPublic: file.isPublic,
  parentId: (file.parentId === ROOT_ID || file.parentId === '0')
    ? ROOT_ID
    : file.parentId.toString(),
});

/**
 * Builds the MongoDB filter matching a parentId (root, ObjectId or raw value).
 * @param {string|number} parentId
 */
const parentIdFilter = (parentId) => {
  if (!parentId || parentId === '0') {
    return { $in: [ROOT_ID, '0'] };
  }
  if (ObjectId.isValid(parentId)) {
    return { $in: [new ObjectId(parentId), parentId.toString()] };
  }
  return parentId;
};

/**
 * Returns the file document owned by the user, or null.
 * @param {string} id
 * @param {object} user
 */
const findUserFile = async (id, user) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const files = await dbClient.filesCollection();
  return files.findOne({ _id: new ObjectId(id), userId: user._id });
};

/**
 * Sets isPublic on a file owned by the authenticated user.
 */
const setPublic = async (req, res, isPublic) => {
  const user = await getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const file = await findUserFile(req.params.id, user);
  if (!file) {
    return res.status(404).json({ error: 'Not found' });
  }

  const files = await dbClient.filesCollection();
  await files.updateOne({ _id: file._id }, { $set: { isPublic } });
  return res.status(200).json(formatFile({ ...file, isPublic }));
};

class FilesController {
  /**
   * POST /files
   */
  static async postUpload(req, res) {
    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name, type, parentId = ROOT_ID, isPublic = false, data,
    } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !ACCEPTED_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (!data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }

    const files = await dbClient.filesCollection();

    let parentRef = ROOT_ID;
    if (parentId && parentId !== '0') {
      const parent = ObjectId.isValid(parentId)
        ? await files.findOne({ _id: new ObjectId(parentId) })
        : null;
      if (!parent) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parent.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
      parentRef = parent._id;
    }

    const newFile = {
      userId: user._id,
      name,
      type,
      isPublic: Boolean(isPublic),
      parentId: parentRef,
    };

    if (type !== 'folder') {
      const folderPath = path.resolve(process.env.FOLDER_PATH || '/tmp/files_manager');
      await fs.promises.mkdir(folderPath, { recursive: true });
      const localPath = path.join(folderPath, uuidv4());
      await fs.promises.writeFile(localPath, Buffer.from(data, 'base64'));
      newFile.localPath = localPath;
    }

    const result = await files.insertOne(newFile);
    newFile._id = result.insertedId;

    if (type === 'image') {
      await fileQueue.add({
        userId: user._id.toString(),
        fileId: result.insertedId.toString(),
      });
    }

    return res.status(201).json(formatFile(newFile));
  }

  /**
   * GET /files/:id
   */
  static async getShow(req, res) {
    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const file = await findUserFile(req.params.id, user);
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json(formatFile(file));
  }

  /**
   * GET /files
   */
  static async getIndex(req, res) {
    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId = ROOT_ID } = req.query;
    const page = Math.max(Number.parseInt(req.query.page, 10) || 0, 0);

    const files = await dbClient.filesCollection();
    const list = await files.aggregate([
      { $match: { userId: user._id, parentId: parentIdFilter(parentId) } },
      { $sort: { _id: 1 } },
      { $skip: page * PAGE_SIZE },
      { $limit: PAGE_SIZE },
    ]).toArray();

    return res.status(200).json(list.map(formatFile));
  }

  /**
   * PUT /files/:id/publish
   */
  static async putPublish(req, res) {
    return setPublic(req, res, true);
  }

  /**
   * PUT /files/:id/unpublish
   */
  static async putUnpublish(req, res) {
    return setPublic(req, res, false);
  }

  /**
   * GET /files/:id/data
   */
  static async getFile(req, res) {
    const { id } = req.params;
    const { size } = req.query;

    if (!ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const files = await dbClient.filesCollection();
    const file = await files.findOne({ _id: new ObjectId(id) });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!file.isPublic) {
      const user = await getUserFromToken(req);
      if (!user || user._id.toString() !== file.userId.toString()) {
        return res.status(404).json({ error: 'Not found' });
      }
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    let filePath = file.localPath;
    if (size !== undefined) {
      if (!THUMBNAIL_SIZES.includes(size)) {
        return res.status(404).json({ error: 'Not found' });
      }
      filePath = `${file.localPath}_${size}`;
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const content = await fs.promises.readFile(filePath);
    res.setHeader('Content-Type', mime.contentType(file.name) || 'application/octet-stream');
    return res.status(200).send(content);
  }
}

export default FilesController;
