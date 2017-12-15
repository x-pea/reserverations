import Influx from 'influx';

const influx = new Influx.InfluxDB(process.env.INFLUX);

exports.createDatabase = (dbName) => {
  return influx.getDatabaseNames()
    .then((names) => {
      if (!names.includes(dbName)) {
        influx.createDatabase(dbName);
      }
    });
};

exports.writePoints = (points, dbName) => {
  return influx.writePoints(points, {
    database: dbName,
    retentionPolicy: 'autogen',
    precision: 'ns',
  });
};
