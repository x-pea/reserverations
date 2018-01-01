import { addAvailability } from '../databases/availabilities';
import Consumer from 'sqs-consumer';
import { config } from 'dotenv';

config();

const translateDates = (blackoutDates) => {
  const translatedDates = {};
  for (let i = 1; i < 13; i++) {
    translatedDates[i] = [null];
  }
  for (let month in blackoutDates) {
    for (let date of blackoutDates[month]) {
      translatedDates[month][date] = 0;
    }
  }
  return translatedDates;
};

const transposeMessage = (message) => {
  const transposedMessage = {
    maxGuestCount: message.maxGuestCount,
    dateAvailability: translateDates(message.blackoutDates),
  };
  if (message.rental) {
    transposedMessage.rental = message.rental;
  }
  if (message.experience) {
    transposedMessage.experience = message.experience;
  }
  return transposedMessage;
};

const sqsConsumer = Consumer.create({
  queueUrl: process.env.SQS_QUEUE_URL,
  handleMessage: (message, done) => {
    const transposedMessage = transposeMessage(JSON.parse(message.Body));
    addAvailability(transposedMessage)
      .then(() => done());
  },
});

sqsConsumer.start();

export { translateDates, transposeMessage }
