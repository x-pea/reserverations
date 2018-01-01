import Influx from 'influx';
import { config } from 'dotenv';

config();

const influx = new Influx.InfluxDB(process.env.INFLUX);

const createDatabase = (dbName) => {
  return influx.getDatabaseNames()
    .then((names) => {
      if (!names.includes(dbName)) {
        influx.createDatabase(dbName);
      }
    });
};

const writePoints = (points, dbName) => {
  return influx.writePoints(points, {
    database: dbName,
    retentionPolicy: 'autogen',
    precision: 'ns',
  });
};

export { createDatabase, writePoints, influx };
