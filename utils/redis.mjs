import { createClient } from 'redis';
import { promisify } from 'util';

/**
 * Wrapper around a Redis client.
 */
class RedisClient {
  constructor() {
    this.client = createClient();
    this.isClientConnected = true;

    this.client.on('error', (err) => {
      console.error('Redis client failed to connect:', err.message || err.toString());
      this.isClientConnected = false;
    });

    this.client.on('connect', () => {
      this.isClientConnected = true;
    });

    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setexAsync = promisify(this.client.setex).bind(this.client);
    this.delAsync = promisify(this.client.del).bind(this.client);
  }

  /**
   * Checks if the connection to Redis is alive.
   * @returns {boolean}
   */
  isAlive() {
    return this.isClientConnected;
  }

  /**
   * Retrieves the value stored for a key.
   * @param {string} key
   * @returns {Promise<string|null>}
   */
  async get(key) {
    return this.getAsync(key);
  }

  /**
   * Stores a value for a key with an expiration.
   * @param {string} key
   * @param {string|number} value
   * @param {number} duration expiration in seconds
   */
  async set(key, value, duration) {
    await this.setexAsync(key, duration, value);
  }

  /**
   * Removes the value stored for a key.
   * @param {string} key
   */
  async del(key) {
    await this.delAsync(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;
