import assert from 'assert';
import { expect } from 'chai';
import Promise from 'bluebird';
import { createQ, readMessage, deleteMessage, sendMessage, deleteQ } from '../server/sqs';
import Consumer from 'sqs-consumer';
import { createClientInput, createInventoryInput, hostOrExp } from '../data-generator/data-gen';
import { createKeyspace, showKeyspaces, dropKeyspace } from '../databases/availabilities';
import { writePoints, createDatabase, influx } from '../databases/reservations';
import { parseReservation, saveReservation } from '../server/clientWorker';
import { config } from 'dotenv';

config();

// No longer necessary with sqs-consumer package
xdescribe('SQS', () => {
  const testURL = process.env.TEST_SQS_QUEUE_URL;
  const qName = 'TEST';
  const testMessage = JSON.stringify({ test: 'object' });

  describe('#createQueue', () => {
    it('should create a queue', (done) => {
      createQ(qName)
        .then((results) => {
          expect(results).to.be.an('object');
          expect(results).to.have.property('ResponseMetadata');
        });
      done();
    });
    it('should create a queue with the provided name', (done) => {
      createQ(qName)
        .then(results => expect(results.QueueUrl).to.include(qName))
      done();
    })
  });

  describe('#sendMessage', () => {
    it('should send a message to designated queue', (done) => {
      sendMessage(testMessage, testURL)
        .then(({ ResponseMetadata, MessageId, MD5OfMessageBody }) => {
          expect(ResponseMetadata).to.be.an('object');
          expect(MessageId).to.be.a('string');
          expect(MD5OfMessageBody).to.be.a('string');
        })
      done();
    });
  });

  describe('#readMessage', () => {
    it('should poll messages from queue', (done) => {
      readMessage(testURL)
        .then(({ Messages }) => {
          expect(Messages).to.have.lengthOf.above(0);
          expect(Messages[0].Body).to.include(testMessage);
          expect(Messages[0].MessageId).to.be.a('string');
        });
      done();
    });

    it('should delete read messages in queue', (done) => {
      readMessage(testURL)
        .then(res => deleteMessage(res, testURL))
        .then(({ ResponseMetadata, Messages }) => {
          expect(ResponseMetadata).to.be.an('object');
          expect(Messages).to.not.exist;
        })
        .then(() => deleteQ(testURL))
        .then(() => done())
        .catch(err => console.error(err));
    });
  });
});

describe('SQS-consumer', () => {
  const testURL = process.env.TEST_SQS_QUEUE_URL;

  describe('#consumer', () => {
    const sqsConsumer = Consumer.create({
      queueUrl: testURL,
      handleMessage: (message, done) => {
        done();
      }
    });

    for (let i = 0; i < 10; i++) {
      const testMessage = JSON.stringify({ count: i });
      sendMessage(testMessage, testURL);
    }
    sqsConsumer.start();

    it('should read and delete messages from queue', (done) => {
      sqsConsumer.on('empty', () => {
        readMessage(testURL)
          .then(({ Messages }) => {
            expect(Messages).to.not.exist;
            sqsConsumer.stop();
          });
      })
      done();
    });
  });

  describe('read and transpose messages', () => {
    it('should transpose each message', () => {
    });
  });

  describe('', () => {
    it('should store transposed messages into database', () => {
    });
  });

});

xdescribe('Data generator', () => {
  describe('#createClientInput', () => {
    const rentalReservation = createClientInput('rental');
    const experienceReservation = createClientInput('experience');

    it('should return a rental entry with properties', () => {
      expect(rentalReservation).to.be.an('object');
      expect(rentalReservation.dates).to.be.an('object');
      expect(rentalReservation.userID).to.be.a('string');
      expect(rentalReservation.guestCount).to.be.a('number');
      expect(rentalReservation).to.have.property('rental');
      expect(rentalReservation.experienceShown).to.be.a('boolean');
    });

    it('should return an experience entry with properties', () => {
      expect(experienceReservation).to.be.an('object');
      expect(experienceReservation.dates).to.be.an('object');
      expect(experienceReservation.userID).to.be.a('string');
      expect(experienceReservation.guestCount).to.be.a('number');
      expect(experienceReservation).to.have.property('experience');
    });
  });

  describe('#createInventoryInput', () => {
    const rentalEntry = createInventoryInput('rental');
    const experienceEntry = createInventoryInput('experience');

    it('should return a rental entry with properties', () => {
      expect(rentalEntry).to.be.an('object');
      expect(rentalEntry.blackoutDates).to.be.an('object');
      expect(rentalEntry.maxGuestCount).to.be.a('number');
      expect(rentalEntry).to.have.property('rental');
    });

    it('should return an experience entry with properties', () => {
      expect(experienceEntry).to.be.an('object');
      expect(experienceEntry.blackoutDates).to.be.an('object');
      expect(experienceEntry.maxGuestCount).to.be.a('number');
      expect(experienceEntry).to.have.property('experience');
    });
  });
});

xdescribe('InfluxDB', () => {
  const dbName = 'reservations';

  describe('#createDatabase', () => {
    it('it should create a database', (done) => {
      createDatabase(dbName)
        .then(() => influx.getDatabaseNames())
        .then(names => expect(names.includes(dbName)).to.be.true)
        .catch(err => console.error(err));
      done();
    });
  });

  describe('#writePoints', () => {
    const entries = [
      {
        measurement: 'home',
        tags: {
          experienceShown: true,
          userID: 'f1808995-ccc-bacc-a2092af9796a',
          rental: '4b8c8f13-d2bd-435d-ac000977',
        },
        fields: {
          dates: JSON.stringify({ 7: [8, 9, 10] }),
          guestCount: 1,
        },
      },
      {
        measurement: 'experience',
        tags: {
          userID: 'c62fcb9-4aef-b071-13c404d865ed',
          rental: 'bfbb2c8-4240-424a-b62e3dde',
        },
        fields: {
          dates: JSON.stringify({ 3: [1, 2, 3] }),
          guestCount: 3,
        },
      },
    ];

    it('should write points into the database', (done) => {
      writePoints(entries, dbName)
        .then(() => influx.query(`select * from home where experienceShown='true'`))
        .then(rows => rows.forEach((row) => {
          expect(row).to.be.an('object');
          expect(row.experienceShown).to.equal('true');
          expect(row).to.have.property('userID');
          expect(row).to.have.property('rental');
          expect(row).to.have.property('dates');
          expect(row).to.have.property('guestCount');
          expect(row).to.have.property('time');
        }))
        .catch(err => console.error(err))
      done();
    });
  });
});

xdescribe('Mass data generation into influxDB', () => {
  const dbName = 'reservations';

  beforeEach(() => {
    influx.dropMeasurement('home', dbName);
    influx.dropMeasurement('experience', dbName);
  });

  const rentalInput = {
    dates: { 7: [8, 9, 10] },
    userID: 'f1808995-ccc-bacc-a2092af9796a',
    guestCount: 1,
    experienceShown: false,
    rental: '4b8c8f13-d2bd-435d-ac000977',
  };
  const experienceInput = {
    dates: { 3: [23, 24, 25, 26, 27, 28] },
    userID: 'c62fcb9-4aef-b071-13c404d865ed',
    guestCount: 3,
    experience: 'bfbb2c8-4240-424a-b62e3dde',
  };

  const expectedRentalOutput = {
    measurement: 'home',
    tags: {
      experienceShown: false,
      userID: 'f1808995-ccc-bacc-a2092af9796a',
      rental: '4b8c8f13-d2bd-435d-ac000977',
    },
    fields: {
      dates: JSON.stringify({ 7: [8, 9, 10] }),
      guestCount: 1,
      count: 1,
    },
  };

  const expectedExperienceOutput = {
    measurement: 'experience',
    tags: {
      userID: 'c62fcb9-4aef-b071-13c404d865ed',
      experience: 'bfbb2c8-4240-424a-b62e3dde',
    },
    fields: {
      dates: JSON.stringify({ 3: [23, 24, 25, 26, 27, 28] }),
      guestCount: 3,
      count: 1,
    },
  };
  const actualRentalOutput = parseReservation(rentalInput);
  const actualExperienceOutput = parseReservation(experienceInput);

  describe('#parseReservation', () => {
    it('should tranpose rental data for storage in influxDB', () => {
      expect(actualRentalOutput).to.deep.equal(expectedRentalOutput);
    });
    it('should tranpose experience data for storage in influxDB', () => {
      expect(actualExperienceOutput).to.deep.equal(expectedExperienceOutput);
    });
  });

  describe('#saveReservation', () => {
    it('should transpose a list of reservation entries and save them to influxDB', (done) => {
      saveReservation([rentalInput, experienceInput])
        .then(() => influx.query(`select * from home where experienceShown='false'`))
        .then((rows) => {
          rows.forEach((row) => {
            expect(row).to.have.property('userID');
            expect(row).to.have.property('rental');
            expect(row).to.have.property('dates');
            expect(row).to.have.property('guestCount');
            expect(row).to.have.property('time');
          });
        });
      done();
    });
  });

  describe('#dataGenerator --> influxDB', () => {
    it('should generate 1000 sets of 10 random reservation entries', (done) => {
      const promises = [];
      for (let j = 0; j < 1000; j++) {
        const storage = [];
        // test SQS message polling limit
        for (let i = 0; i < 10; i++) {
          storage.push(createClientInput(hostOrExp()));
        }
        promises.push(saveReservation(storage));
      }
      Promise.all(promises)
        .then(() => influx.query('select * from home, experience'))
        .then(rows => expect(rows.length).to.equal(10000))
        .then(() => done());
    });
  });
});

describe('Scylla', () => {
  const keyspace = 'availabilities';
  describe('#createKeyspace', () => {
    it('should create a new keyspace', () => {
      createKeyspace(keyspace)
        .then(res => expect(res).to.be.empty)
        .catch(err => console.error('Error creating namespace', err));
    });

    after(() => {
      dropKeyspace(keyspace)
        .then(res => console.log(res))
        .catch(err => console.error('Error dropping keyspace', err));
    })
  });
  describe('#queryDatabase', () => {});
  describe('#addAvailability', () => {});
  describe('#updateAvailability', () => {});
});

xdescribe('serviceWorker', () => {
  const clientMessage = JSON.stringify({
    dates: { 7: [8, 9, 10] },
    userID: 'f1808995-ccc-bacc-a2092af9796a',
    guestCount: 1,
    experienceShown: false,
    rental: '4b8c8f13-d2bd-435d-ac000977',
  });
  const inventoryMessage = JSON.stringify({
    blackoutDates: { 3: [23, 24, 25, 26, 27, 28] },
    maxGuestCount: 4,
    experienceShown: false,
    experience: '4b8c8f13-d2bd-435d-ac000977',
  });
});
