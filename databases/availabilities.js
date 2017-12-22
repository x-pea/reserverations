import cassandra from 'cassandra-driver';
import Promise from 'bluebird';
import { config } from 'dotenv';

config();

const client = new cassandra.Client({ contactPoints: [process.env.SCYLLA] });
client.execute = Promise.promisify(client.execute);

const createKeyspace = (keyspace) => {
  return client.execute(`CREATE KEYSPACE ${keyspace} WITH REPLICATION = {'class': 'SimpleStrategy', 'replication_factor': 3}`)
};

const dropKeyspace = (keyspace) => {
  return client.execute(`DROP KEYSPACE ${keyspace}`)
};

// const queryDatabase = () => {}
//
// const addAvailability = () => {}
//
// const updateAvailability = () => {}

export { createKeyspace, showKeyspaces, dropKeyspace };
