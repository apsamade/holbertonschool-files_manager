import { ObjectId } from 'mongodb';
import redisClient from './redis';
import dbClient from './db';

/**
 * Builds the Redis key holding the user ID for a token.
 * @param {string} token
 * @returns {string}
 */
export const authKey = (token) => `auth_${token}`;

/**
 * Returns the user ID linked to the X-Token header, or null.
 * @param {import('express').Request} req
 * @returns {Promise<string|null>}
 */
export async function getUserIdFromToken(req) {
  const token = req.header('X-Token');
  if (!token) {
    return null;
  }
  const userId = await redisClient.get(authKey(token));
  return userId || null;
}

/**
 * Returns the user document linked to the X-Token header, or null.
 * @param {import('express').Request} req
 */
export async function getUserFromToken(req) {
  const userId = await getUserIdFromToken(req);
  if (!userId || !ObjectId.isValid(userId)) {
    return null;
  }
  const users = await dbClient.usersCollection();
  return users.findOne({ _id: new ObjectId(userId) });
}
