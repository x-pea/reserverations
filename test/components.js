import assert from 'assert';
import { expect } from 'chai';
import Influx from 'influx';
import { createQ, readMessage, deleteMessage, sendMessage, deleteQ } from '../server/sqs';
import { createClientInput, createInventoryInput } from '../data-generator/data-gen';
import { writePoints, createDatabase } from '../databases/reservations';
import { config } from 'dotenv';

config();

describe('SQS', () => {
  const testURL = process.env.TEST_SQS_QUEUE_URL;
  const qName = 'TEST';
  const testMessage = 'this is a test';

  describe('#createQueue', () => {
    it('should create a queue', (done) => {
      createQ(qName)
        .then((results) => {
          expect(results).to.be.an('object');
          expect(results).to.have.property('ResponseMetadata');
        })
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
        .then((res) => {
          expect(res.ResponseMetadata).to.be.an('object');
          expect(res.MessageId).to.be.a('string');
          expect(res.MD5OfMessageBody).to.be.a('string');
        })
      done();
    });
  });

  describe('#readMessage', () => {
    it('should poll messages from queue', (done) => {
      readMessage(testURL)
        .then((res) => {
          expect(res.Messages).to.have.lengthOf.above(0);
          expect(res.Messages[0].Body).to.include(testMessage);
        });
      done();
    });

    it('should delete read messages in queue', (done) => {
      readMessage(testURL)
        .then(res => deleteMessage(res, testURL))
        .then((res) => {
          expect(res.ResponseMetadata).to.be.an('object');
          expect(res.Messages).to.not.exist;
        })
        .then(() => deleteQ(testURL))
        .then(() => done())
        .catch(err => console.error(err));
    });
  });
});

describe('Data generator', () => {
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

describe('InfluxDB', () => {
  const influx = new Influx.InfluxDB(process.env.INFLUX);
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

  describe('#writePoint', () => {
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