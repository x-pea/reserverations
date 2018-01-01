import assert from 'assert';
import { expect } from 'chai';
import Promise from 'bluebird';
import Consumer from 'sqs-consumer';
import { translateDates, transposeMessage } from '../server/inventoryWorker';
import { writePoints, createDatabase, influx } from '../databases/reservations';
import { createClientInput, createInventoryInput, hostOrExp } from '../data-generator/data-gen';
import { config } from 'dotenv';
import { createQ, readMessage, deleteMessage,
  sendMessage, deleteQ } from '../server/sqs';
import { Rental, Experience, addAvailability,
  queryAvailability, updateAvailability } from '../databases/availabilities';
import { assignReservationId, checkAvail, updateAvailabilities, parseReservation,
  saveReservation, confirmAvailability } from '../server/clientWorker';

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
        .catch(err => console.error(err));
    });
    it('should create a queue with the provided name', (done) => {
      createQ(qName)
        .then(results => expect(results.QueueUrl).to.include(qName))
        .then(() => done())
        .catch(err => console.error(err));
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
        .catch(err => console.error(err));
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
        .catch(err => console.error(err));
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
          .catch(err => console.error(err));
      })
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
      expect(rentalReservation.userId).to.be.a('string');
      expect(rentalReservation.guestCount).to.be.a('number');
      expect(rentalReservation).to.have.property('rental');
      expect(rentalReservation.experienceShown).to.be.a('boolean');
    });

    it('should return an experience entry with properties', () => {
      expect(experienceReservation).to.be.an('object');
      expect(experienceReservation.dates).to.be.an('object');
      expect(experienceReservation.userId).to.be.a('string');
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
        measurement: 'rental',
        tags: {
          experienceShown: true,
          userId: 'f1808995-ccc-bacc-a2092af9796a',
          rental: 8219071282,
          reservationId: '1214235',
        },
        fields: {
          dates: JSON.stringify({ 7: [8, 9, 10] }),
          guestCount: 1,
        },
      },
      {
        measurement: 'experience',
        tags: {
          userId: 'c62fcb9-4aef-b071-13c404d865ed',
          rental: 23498032,
          reservationId: '12435253',
        },
        fields: {
          dates: JSON.stringify({ 3: [1, 2, 3] }),
          guestCount: 3,
        },
      },
    ];

    it('should write points into the database', (done) => {
      writePoints(entries, dbName)
        .then(() => influx.query(`select * from rental where experienceShown='true'`))
        .then(rows => rows.forEach((row) => {
          expect(row).to.be.an('object');
          expect(row.experienceShown).to.equal('true');
          expect(row).to.have.property('userId');
          expect(row).to.have.property('rental');
          expect(row).to.have.property('dates');
          expect(row).to.have.property('guestCount');
          expect(row).to.have.property('time');
          expect(row).to.have.property('reservationId');
        }))
        .then(() => done())
        .catch(err => console.error(err));
    });
  });
});

xdescribe('Mass data generation into influxDB', () => {
  const dbName = 'reservations';

  beforeEach(() => {
    influx.dropMeasurement('rental', dbName);
    influx.dropMeasurement('experience', dbName);
  });

  const rentalInput = {
    dates: { 7: [8, 9, 10] },
    userId: 'f1808995-ccc-bacc-a2092af9796a',
    guestCount: 1,
    experienceShown: false,
    rental: 141251424,
  };
  const experienceInput = {
    dates: { 3: [23, 24, 25, 26, 27, 28] },
    userId: 'c62fcb9-4aef-b071-13c404d865ed',
    guestCount: 3,
    experience: 574584646,
  };

  const expectedRentalOutput = {
    measurement: 'rental',
    tags: {
      experienceShown: false,
      userId: 'f1808995-ccc-bacc-a2092af9796a',
      rental: 141251424,
      reservationId: '12453rwekr2',
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
      userId: 'c62fcb9-4aef-b071-13c404d865ed',
      experience: 574584646,
      reservationId: '12f32324',
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
        .then(() => influx.query(`select * from rental where experienceShown='false'`))
        .then((rows) => {
          rows.forEach((row) => {
            expect(row).to.have.property('userId');
            expect(row).to.have.property('rental');
            expect(row).to.have.property('dates');
            expect(row).to.have.property('guestCount');
            expect(row).to.have.property('time');
            expect(row).to.have.property('reservationId');
          });
        })
        .catch(err => done(err));
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
        .then(() => influx.query('select * from rental, experience'))
        .then(rows => expect(rows.length).to.equal(10000))
        .then(() => done())
        .catch(err => console.error(err));
    });
  });
});

xdescribe('MongoDb', () => {
  const rentalEntry = {
    dateAvailability: { 1: [null, 5, 5, 2, 1], 2: [null, 3] },
    maxGuestCount: 7,
    rental: 12431424
  };

  const expEntry = {
    dateAvailability: { 1: [null, 5, 5, 2, 1], 2: [null, 3] },
    maxGuestCount: 7,
    experience: 12431424
  };

  const sampleId = 12431424;

  describe('#addAvailability', () => {
    before((done) => {
      Experience.findOneAndRemove({ experience: sampleId })
        .then(() => Rental.findOneAndRemove({ rental: sampleId }))
        .then(() => done())
        .catch(err => console.error(err))
    });

    it('should add a new rental listing', (done) => {
      addAvailability(rentalEntry)
        .then((res) => {
          expect(res.dateAvailability).to.be.an('object');
          expect(res).to.have.property('maxGuestCount');
          expect(res).to.have.property('rental');
        })
        .then(() => done())
        .catch(err => console.error(err));
    });

    it('should add a new experience listing', (done) => {
      addAvailability(expEntry)
        .then((res) => {
          expect(res.dateAvailability).to.be.an('object');
          expect(res).to.have.property('maxGuestCount');
          expect(res).to.have.property('experience');
        })
        .then(() => done())
        .catch(err => console.error(err));
    });
  });

  describe('#queryDatabase', () => {
    it('should find rental listing by id', (done) => {
      queryAvailability('rental', sampleId)
        .then((res) => {
          expect(res.dateAvailability).to.deep.equal(rentalEntry.dateAvailability);
          expect(res.maxGuestCount).to.equal(rentalEntry.maxGuestCount);
          expect(res.rental).to.equal(rentalEntry.rental);
        })
        .then(() => done())
        .catch(err => console.error(err));
    })

    it('should find experience listing by id', (done) => {
      queryAvailability('experience', sampleId)
        .then((res) => {
          expect(res.dateAvailability).to.deep.equal(expEntry.dateAvailability);
          expect(res.maxGuestCount).to.equal(expEntry.maxGuestCount);
          expect(res.rental).to.equal(expEntry.rental);
        })
        .then(() => done())
        .catch(err => console.error(err));
    })
  });

  describe('#updateAvailability', () => {
    it('should update the rental listing availability of date', (done) => {
      updateAvailability('rental', sampleId, 1, 1, 3)
        .then(res => expect(res.ok).to.equal(1))
        .then(() => queryAvailability('rental', sampleId))
        .then(entry => expect(entry.dateAvailability['1'][1]).to.equal(3))
        .then(() => done())
        .catch(err => console.error(err));
    });

    it('should update the experience listing availability of date', (done) => {
      updateAvailability('experience', sampleId, 1, 1, 3)
        .then(res => expect(res.ok).to.equal(1))
        .then(() => queryAvailability('experience', sampleId))
        .then(entry => expect(entry.dateAvailability['1'][1]).to.equal(3))
        .then(() => done())
        .catch(err => console.error(err));
    });
  });
});

describe('clientWorker', () => {
  const sampleInput = {
    dates: { 2: [28, 29], 3: [1, 2, 3] },
    userId: 'fasdjfk234',
    guestCount: 1,
    experienceShown: false,
    rental: '123024',
  };

  const falsyInput = {
    dates: { 2: [28, 29], 3: [1, 2, 3] },
    userId: 'fasdjfk234',
    guestCount: 5,
    experienceShown: false,
    rental: '123024',
  };

  const reservationEntry = {
    dates: { 2: [28, 29], 3: [1, 2, 3] },
    userId: 'fasdjfk234',
    guestCount: 1,
    experienceShown: false,
    rental: '123024',
    reservationId: '12f32324',
  };

  const fill = Array(27).fill(null);
  fill[28] = 5;
  fill[29] = 4;
  const falseAvail = { 2: fill, 3: [null, 0, 3, 3, 0, 0] };
  const trueAvail = { 2: fill, 3: [null, 4, 4, 3, 2, 1] };
  const nullAvail = { 2: fill, 3: [null, null, null, 3, 2, 1] };
  const newAvail = { 2: { 28: 4, 29: 3 }, 3: { 1: 3, 2: 3, 3: 2 } };

  const availabilityListing = {
    dateAvailability: {
      1: [null],
      2: fill,
      3: [null, 4, 4, 3, 2, 1],
      4: [null],
      5: [null],
      6: [null],
      7: [null],
      8: [null],
      9: [null],
      10: [null],
      11: [null],
      12: [null],
    },
    maxGuestCount: 7,
    rental: 123024,
  };

  xdescribe('#assignReservationId', () => {
    it('should assign a reservationId utilizing userId and listingId', () => {
      const reservationId = assignReservationId(sampleInput.userId, sampleInput.rental);
      expect(reservationId.slice(0, 3)).to.equal(sampleInput.userId.slice(0, 3));
      expect(reservationId.slice(3)).to.equal(String(sampleInput.rental).slice(0, 5));
    });
  });

  xdescribe('#checkAvail', () => {
    it('should return false if listing is not available', () => {
      const availability = checkAvail(sampleInput.guestCount, sampleInput.dates, falseAvail, 4);
      expect(availability).to.be.false;
    });

    it('should return new availability if listing is available', () => {
      const availability = checkAvail(sampleInput.guestCount, sampleInput.dates, trueAvail, 4);
      expect(availability).to.be.an('object');
      expect(availability).to.eql(newAvail);
    });

    it('should account for availabilities not yet defined', () => {
      const availability = checkAvail(sampleInput.guestCount, sampleInput.dates, nullAvail, 4);
      expect(availability).to.be.an('object');
      expect(availability).to.eql(newAvail);
    });
  });

  xdescribe('#updateAvailabilities', () => {
    const availability = checkAvail(
      sampleInput.guestCount,
      sampleInput.dates,
      availabilityListing.dateAvailability,
      availabilityListing.maxGuestCount,
    );

    before((done) => {
      addAvailability(availabilityListing)
        .then(() => updateAvailabilities('rental', availabilityListing.rental, availability))
        .then(() => done())
        .catch(err => console.error(err));
    });

    it('should update inventory with new availabilities', () => {
      queryAvailability('rental', sampleInput.rental)
        .then(({ dateAvailability }) => {
          expect(dateAvailability['2'][28]).to.equal(4);
          expect(dateAvailability['2'][29]).to.equal(3);
          expect(dateAvailability['3'][1]).to.equal(3);
          expect(dateAvailability['3'][2]).to.equal(3);
          expect(dateAvailability['3'][3]).to.equal(2);
          expect(dateAvailability['3'][4]).to.equal(2);
          expect(dateAvailability['3'][5]).to.equal(1);
        });
    });

    after((done) => {
      Rental.findOneAndRemove({ rental: availabilityListing.rental })
        .then(() => done())
        .catch(err => console.error(err));
    });
  });

  describe('#confirmAvailability', () => {
    let response;
    let falsyResponse;

    before((done) => {
      addAvailability(availabilityListing)
        .then(() => confirmAvailability(sampleInput))
        .then((res) => { response = res; })
        .then(() => confirmAvailability(falsyInput))
        .then((res) => { falsyResponse = res; })
        .then(() => done())
        .catch(err => console.error(err));
    });

    it('should save reservation to influxdb if available', () => {
      influx.query(`select * from rental where experienceShown='false'`)
        .then((rows) => {
          expect(rows.length).to.equal(1);
          expect(rows[0].userId).to.have.equal(reservationEntry.userId);
          expect(rows[0].rental).to.have.equal(reservationEntry.rental);
          expect(JSON.parse(rows[0].dates)).to.have.deep.eql(reservationEntry.dates);
          expect(rows[0].guestCount).to.have.equal(reservationEntry.guestCount);
          expect(rows[0]).to.have.property('time');
          expect(rows[0]).to.have.property('count');
        });
    });

    it('should update listing availability in mongodb if available', () => {
      queryAvailability('rental', sampleInput.rental)
        .then(({ dateAvailability }) => {
          expect(dateAvailability['2'][28]).to.equal(4);
          expect(dateAvailability['2'][29]).to.equal(3);
          expect(dateAvailability['3'][1]).to.equal(3);
          expect(dateAvailability['3'][2]).to.equal(3);
          expect(dateAvailability['3'][3]).to.equal(2);
          expect(dateAvailability['3'][4]).to.equal(2);
          expect(dateAvailability['3'][5]).to.equal(1);
        });
    });

    it('should return a response with a reservation id if available', () => {
      expect(response).to.have.property('reservationId');
    });

    it('should return false if listing is not available', () => {
      expect(falsyResponse.available).to.be.false;
    });

    after((done) => {
      influx.dropMeasurement('rental', 'reservations');
      influx.dropMeasurement('experience', 'reservations');
      Rental.findOneAndRemove({ rental: availabilityListing.rental })
        .then(() => done())
        .catch(err => console.error(err));
    });
  });
});

xdescribe('inventoryWorker', () => {
  const sampleInput = {
    blackoutDates: { 3: [3, 4, 5] },
    maxGuestCount: 7,
    rental: 78673467,
  };

  const sampleOutput = {
    dateAvailability: {
      1: [null],
      2: [null],
      3: [null, undefined, undefined, 0, 0, 0],
      4: [null],
      5: [null],
      6: [null],
      7: [null],
      8: [null],
      9: [null],
      10: [null],
      11: [null],
      12: [null],
    },
    maxGuestCount: 7,
    rental: 78673467,
  };

  const dbOutput = {
    dateAvailability: {
      1: [null],
      2: [null],
      3: [null, null, null, 0, 0, 0],
      4: [null],
      5: [null],
      6: [null],
      7: [null],
      8: [null],
      9: [null],
      10: [null],
      11: [null],
      12: [null],
    },
    maxGuestCount: 7,
    rental: 78673467,
  };

  describe('#translateDates', () => {
    it('should translate blackout dates to date availabilities', () => {
      const actualMessage = translateDates(sampleInput.blackoutDates);
      expect(actualMessage).to.deep.eql(sampleOutput.dateAvailability);
    });
  });

  describe('#transposeMessage', () => {
    it('should tranpose sampleInput with a dateAvailability property', () => {
      const actualMessage = transposeMessage(sampleInput);
      expect(actualMessage).to.deep.eql(sampleOutput);
    });
  });

  describe('#pollQueue', () => {
    before((done) => {
      const testMessage = JSON.stringify(sampleInput);
      sendMessage(testMessage, process.env.SQS_QUEUE_URL)
        .then(() => done())
        .catch(err => console.error(err));
    });

    it('should poll messages from queue and store tranposed messages into database', (done) => {
      queryAvailability('rental', sampleInput.rental)
        .then((res) => {
          expect(res.dateAvailability).to.deep.equal(dbOutput.dateAvailability);
          expect(res.maxGuestCount).to.equal(dbOutput.maxGuestCount);
        })
        .then(() => done())
        .catch(err => console.error(err));
    });

    after((done) => {
      Rental.findOneAndRemove({ rental: sampleInput.rental })
        .then(() => done())
        .catch(err => console.error(err));
    });
  });
});
