import { addAvailability } from '../databases/availability';
import Consumer from 'sqs-consumer';

const sqsConsumer = Consumer.create({
  queueUrl: process.env.SQS_QUEUE_URL,
  handleMessage: (message, done) => {
    // transpose each messages
    // store new availabilities into db
    done();
  },
});

const retrieveAvailability = () => {
// poll messages from inventories
// check for sqs message duplicates
  sqsConsumer.start();
};


sqsConsumer.on('error', (err) => {
  console.log(err.message);
});
