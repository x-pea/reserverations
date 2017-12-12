const assert = require('assert');
const { should, expect } = require('chai');
const {
  createQ,
  readMessage,
  deleteMessage,
  sendMessage
} = require('../server/sqs');
require('dotenv').config();

describe('SQS', () => {
  const testURL = process.env.TEST_SQS_QUEUE_URL;
  const qName = 'TEST';
  const testMessage = 'this is a test';

  describe('Create queue', () => {
    it('should create a queue', () => {
      createQ(qName)
        .then((results) => {
          expect(results).to.be.an('object');
          expect(results).to.have.property('ResponseMetadata');
        })
    });
    it('should create a queue with the provided name', () => {
      createQ(qName)
        .then(results => expect(results.QueueUrl).to.include(qName))
    })
  });

  describe('Send message to queue', () => {
    it('should send a message to designated queue', () => {
      sendMessage(testMessage, testURL)
        .then((res) => {
          expect(res.ResponseMetadata).to.be.an('object');
          expect(res.MessageId).to.be.a('string');
          expect(res.MD5OfMessageBody).to.be.a('string');
        })
    });
  });

  describe('Read & delete messages in queue', () => {
    it('should poll messages from queue', () => {
      readMessage(testURL)
        .then((res) => {
          expect(res.Messages).to.have.lengthOf.above(1);
          expect(res.Messages[0].Body).to.include(testMessage);
        });
    });
    it('should delete read messages in queue', () => {
      readMessage(testURL)
        .then(res => deleteMessage(res, testURL))
        .then((res) => {
          expect(res.ResponseMetadata).to.be.an('object');
          expect(res.Messages).to.not.exist;
        });
    });
  });
});
