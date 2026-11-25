import mongodb from 'mongodb';

const { MongoClient } = mongodb;

/**
 * Wrapper around a MongoDB client.
 */
class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';

    this.connected = false;
    this.db = null;
    this.client = new MongoClient(`mongodb://${host}:${port}`, { useUnifiedTopology: true });

    this.connection = this.client.connect()
      .then(() => {
        this.db = this.client.db(database);
        this.connected = true;
      })
      .catch((err) => {
        console.error('MongoDB client failed to connect:', err.message || err.toString());
        this.connected = false;
      });
  }

  /**
   * Checks if the connection to MongoDB is alive.
   * @returns {boolean}
   */
  isAlive() {
    return this.connected && Boolean(this.client.topology && this.client.topology.isConnected());
  }

  /**
   * Returns a collection once the connection is established.
   * @param {string} name
   */
  async collection(name) {
    await this.connection;
    if (!this.db) {
      throw new Error('MongoDB is not connected');
    }
    return this.db.collection(name);
  }

  /**
   * Returns the users collection.
   */
  async usersCollection() {
    return this.collection('users');
  }

  /**
   * Returns the files collection.
   */
  async filesCollection() {
    return this.collection('files');
  }

  /**
   * Returns the number of documents in the users collection.
   * @returns {Promise<number>}
   */
  async nbUsers() {
    return (await this.usersCollection()).countDocuments();
  }

  /**
   * Returns the number of documents in the files collection.
   * @returns {Promise<number>}
   */
  async nbFiles() {
    return (await this.filesCollection()).countDocuments();
  }
}

const dbClient = new DBClient();
export default dbClient;
