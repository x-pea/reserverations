import assert from 'assert';
import { expect } from 'chai';
import Promise from 'bluebird';
import { createQ, readMessage, deleteMessage, sendMessage, deleteQ } from '../server/sqs';
import Consumer from 'sqs-consumer';
import { createClientInput, createInventoryInput, hostOrExp } from '../data-generator/data-gen';
import { Home, Experience, addAvailability, queryHome, queryExperience, updateAvailability } from '../databases/availabilities';
import { writePoints, createDatabase, influx } from '../databases/reservations';
import { parseReservation, saveReservation } from '../server/clientWorker';
import { translateDates, transposeMessage, pollQueue } from '../server/inventoryWorker';
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
        })
        .then(() => done())
        .catch(err => console.error('Error creating a queue', err));
    });
    it('should create a queue with the provided name', (done) => {
      createQ(qName)
        .then(results => expect(results.QueueUrl).to.include(qName))
        .then(() => done())
        .catch(err => console.error('Error creating a queue'));
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
        .then(() => done())
        .catch(err => console.error('Error sending message to queue', err))
    });
  });

  describe('#readMessage', () => {
    it('should poll messages from queue', (done) => {
      readMessage(testURL)
        .then(({ Messages }) => {
          expect(Messages).to.have.lengthOf.above(0);
          expect(Messages[0].Body).to.include(testMessage);
          expect(Messages[0].MessageId).to.be.a('string');
        })
        .then(() => done())
        .catch(err => console.error('Error reading message from queue'))
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
        .catch(err => console.error('Error creating deleting messages from queue', err));
    });
  });
});

xdescribe('SQS-consumer', () => {
  const testURL = process.env.TEST_SQS_QUEUE_URL;

  describe('#consumer', () => {
    const sqsConsumer = Consumer.create({
      queueUrl: testURL,
      handleMessage: (message, done) => {
        done();
      }
    });
    sqsConsumer.start();

    for (let i = 0; i < 10; i++) {
      const testMessage = JSON.stringify({ count: i });
      sendMessage(testMessage, testURL);
    }

    it('should read and delete messages from queue', (done) => {
      sqsConsumer.on('empty', () => {
        readMessage(testURL)
          .then(({ Messages }) => {
            expect(Messages).to.not.exist;
            sqsConsumer.stop();
          })
          .then(() => done())
          .catch(err => new Error('Error reading and deleting messages from queue'))
      })
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
        .then(() => done())
        .catch(err => console.error(err));
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
        .then(() => done())
        .catch(err => console.error(err))
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
        })
        .then(() => done())
        .catch(err => console.error('Error saving reservations', err));
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

xdescribe('MongoDb', () => {
  const homeEntry = {
    dates: { 1: [null, 5, 5, 2, 1], 2: [null, 3] },
    maxGuestCount: 7,
    rental: 12431424
  };

  const expEntry = {
    dates: { 1: [null, 5, 5, 2, 1], 2: [null, 3] },
    maxGuestCount: 7,
    experience: 12431424
  };

  const sampleId = 12431424;

  describe('#addAvailability', () => {
    before((done) => {
      Experience.findOneAndRemove({ experience: sampleId })
        .then(() => Home.findOneAndRemove({ rental: sampleId }))
        .then(() => done())
    });

    it('should add a new home listing', (done) => {
      addAvailability(homeEntry)
        .then((res) => {
          expect(res.dates).to.be.an('object');
          expect(res).to.have.property('maxGuestCount');
          expect(res).to.have.property('rental');
        })
        .then(() => done())
        .catch(err => console.error('Error adding entry', err));
    });

    it('should add a new experience listing', (done) => {
      addAvailability(expEntry)
        .then((res) => {
          expect(res.dates).to.be.an('object');
          expect(res).to.have.property('maxGuestCount');
          expect(res).to.have.property('experience');
        })
        .then(() => done())
        .catch(err => console.error('Error adding entry', err));
    });
  });

  describe('#queryDatabase', () => {
    it('should find home listing by id', (done) => {
      queryHome(sampleId)
        .then((res) => {
          expect(res.dates).to.deep.equal(homeEntry.dates);
          expect(res.maxGuestCount).to.equal(homeEntry.maxGuestCount);
          expect(res.rental).to.equal(homeEntry.rental);
        })
        .then(() => done())
        .catch(err => console.error('Error querying collection', err));
    })

    it('should find experience listing by id', (done) => {
      queryExperience(sampleId)
        .then((res) => {
          expect(res.dates).to.deep.equal(expEntry.dates);
          expect(res.maxGuestCount).to.equal(expEntry.maxGuestCount);
          expect(res.rental).to.equal(expEntry.rental);
        })
        .then(() => done())
        .catch(err => console.error('Error querying collection', err));
    })
  });

  describe('#updateAvailability', () => {
    it('should update the home listing availability of date', (done) => {
      updateAvailability('home', sampleId, 1, 1, 3)
        .then(res => expect(res.ok).to.equal(1))
        .then(() => queryHome(sampleId))
        .then(entry => expect(entry.dates['1'][1]).to.equal(3))
        .then(() => done())
        .catch(err => console.error('Error updating availabiility', err));
    });

    it('should update the experience listing availability of date', (done) => {
      updateAvailability('exp', sampleId, 1, 1, 3)
        .then(res => expect(res.ok).to.equal(1))
        .then(() => queryExperience(sampleId))
        .then(entry => expect(entry.dates['1'][1]).to.equal(3))
        .then(() => done())
        .catch(err => console.error('Error updating availabiility', err));
    });
  });
});

xdescribe('clientWorker', () => {
  const clientMessage = JSON.stringify({
    dates: { 7: [8, 9, 10] },
    userID: 87756789,
    guestCount: 1,
    experienceShown: false,
    rental: 123024,
  });
  const inventoryMessage = JSON.stringify({
    blackoutDates: { 3: [23, 24, 25, 26, 27, 28] },
    maxGuestCount: 4,
    experienceShown: false,
    experience: 123024,
  });
});

describe('inventoryWorker', () => {
  const sampleInput1 = {
    blackoutDates: { 3: [3, 4, 5] },
    maxGuestCount: 7,
    rental: 78673467,
  }

  const sampleInput2 = {
    blackoutDates: { 1: [2, 3] },
    maxGuestCount: 3,
    rental: 4687674,
  };

  const sampleOutput1 = {
    dateAvailability: { 3: [null, undefined, undefined, 0, 0, 0] },
    maxGuestCount: 7,
    rental: 78673467,
  };

  const sampleOutput2 = {
    dateAvailability: { 1: [null, null, 0, 0] },
    maxGuestCount: 3,
    rental: 4687674,
  };

  describe('#translateDates', () => {
    it('should translate blackout dates to date availabilities', () => {
      const actualMessage = translateDates(sampleInput1.blackoutDates);
      expect(actualMessage).to.deep.eql(sampleOutput1.dateAvailability);
    });
  });

  describe('#transposeMessage', () => {
    it('should tranpose sampleInput with a dateAvailability property', () => {
      const actualMessage = transposeMessage(sampleInput1);
      expect(actualMessage).to.deep.eql(sampleOutput1);
    });
  });

  describe('#pollQueue', () => {
    before((done) => {
      const testMessage = JSON.stringify(sampleInput1);
      sendMessage(testMessage, process.env.SQS_QUEUE_URL)
        .then(() => done())
        .catch(err => console.error('Failed to send test sqs message', err));
    });

    it('should poll messages from queue and store tranposed messages into database', (done) => {
      queryHome(4687674)
        .then((res) => {
          console.log(res)
          expect(res.dateAvailability).to.deep.equal(sampleOutput2.dateAvailability);
          expect(res.maxGuestCount).to.equal(sampleOutput2.maxGuestCount);
        })
        .then(() => done())
        .catch(err => console.error('Error polling & storing messages', err));
    });
  });
});
