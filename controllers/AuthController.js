import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import { authKey } from '../utils/auth';

const TOKEN_DURATION = 24 * 60 * 60;

class AuthController {
  /**
   * GET /connect
   */
  static async getConnect(req, res) {
    const authorization = req.header('Authorization') || '';
    const [scheme, encoded] = authorization.split(' ');
    if (scheme !== 'Basic' || !encoded) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const credentials = Buffer.from(encoded, 'base64').toString('utf-8');
    const separator = credentials.indexOf(':');
    if (separator === -1) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const email = credentials.slice(0, separator);
    const password = credentials.slice(separator + 1);

    const users = await dbClient.usersCollection();
    const user = await users.findOne({ email, password: sha1(password) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = uuidv4();
    await redisClient.set(authKey(token), user._id.toString(), TOKEN_DURATION);
    return res.status(200).json({ token });
  }

  /**
   * GET /disconnect
   */
  static async getDisconnect(req, res) {
    const token = req.header('X-Token');
    const userId = token ? await redisClient.get(authKey(token)) : null;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await redisClient.del(authKey(token));
    return res.status(204).send();
  }
}

export default AuthController;
