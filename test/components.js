import assert from 'assert';
import { should, expect } from 'chai';
import {
  createQ,
  readMessage,
  deleteMessage,
  sendMessage
} from '../server/sqs';
import {
  createClientInput,
  createInventoryInput
} from '../data-generator/data-gen';
import { config } from 'dotenv';

config();

describe('SQS', () => {
  const testURL = process.env.TEST_SQS_QUEUE_URL;
  const qName = 'TEST';
  const testMessage = 'this is a test';

  describe('Create queue', () => {
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

  describe('Send message to queue', () => {
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

  describe('Read & delete messages in queue', () => {
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
        });
      done();
    });
  });
});

describe('Data generator', () => {
  describe('createClientInput should generate rental and experience data', () => {
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

  describe('createInventoryInput should generate rental and experience data', () => {
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
