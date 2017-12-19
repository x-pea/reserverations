import Promise from 'bluebird';
import AWS from 'aws-sdk';
import { config } from 'dotenv';

config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const sqs = new AWS.SQS();
sqs.createQueue = Promise.promisify(sqs.createQueue);
sqs.receiveMessage = Promise.promisify(sqs.receiveMessage);
sqs.deleteMessage = Promise.promisify(sqs.deleteMessage);
sqs.sendMessage = Promise.promisify(sqs.sendMessage);

const createQ = (name) => {
  const params = {
    QueueName: name,
    Attributes: {
      DelaySeconds: '60',
      MessageRetentionPeriod: '86400',
      ReceiveMessageWaitTimeSeconds: '20',
    },
  };
  return sqs.createQueue(params);
};

const readMessage = (queueUrl) => {
  const params = {
    AttributeNames: ['SentTimestamp'],
    MaxNumberOfMessages: 10,
    MessageAttributeNames: ['All'],
    QueueUrl: queueUrl,
    VisibilityTimeout: 30,
    WaitTimeSeconds: 20,
  };
  return sqs.receiveMessage(params);
};

const deleteMessage = (data, queueUrl) => {
  const deleteParams = {
    QueueUrl: queueUrl,
    ReceiptHandle: data.Messages[0].ReceiptHandle,
  };
  return sqs.deleteMessage(deleteParams);
};

const sendMessage = (message, queueUrl) => {
  const params = {
    DelaySeconds: 10,
    MessageAttributes: {},
    MessageBody: message,
    QueueUrl: queueUrl,
  };
  return sqs.sendMessage(params);
};

// only used during testing
const deleteQ = queueUrl => sqs.deleteQueue({ QueueUrl: queueUrl });

export { createQ, readMessage, deleteMessage, sendMessage, deleteQ }
