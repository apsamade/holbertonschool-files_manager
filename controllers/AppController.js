import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  /**
   * GET /status
   */
  static getStatus(req, res) {
    return res.status(200).json({ redis: redisClient.isAlive(), db: dbClient.isAlive() });
  }

  /**
   * GET /stats
   */
  static async getStats(req, res) {
    const [users, files] = await Promise.all([dbClient.nbUsers(), dbClient.nbFiles()]);
    return res.status(200).json({ users, files });
  }
}

export default AppController;
