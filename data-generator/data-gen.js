import { fake, random } from 'faker/locale/en';
import { influx } from '../databases/reservations'
import { transSend } from '../server/worker';
import Promise from 'bluebird';

const randomRangeNumber = (n1, n2) => {
  return random.number({ min: n1, max: n2 });
};

const hostOrExp = () => random.arrayElement(['rental', 'experience'])

const randomDateRange = () => {
  const start = random.number(24);
  const range = [start];
  const end = start + Math.floor(Math.random() * 7);
  let i = start;
  while (i < end) {
    i += 1;
    range.push(i);
  }
  return range;
};

const createClientInput = (type) => {
  const entry = {
    dates: {},
    userID: random.uuid(),
    guestCount: randomRangeNumber(1, 5),
  };
  if (type === 'rental') {
    entry.experienceShown = random.boolean();
  }
  entry[type] = random.uuid();
  entry.dates[randomRangeNumber(1, 12)] = randomDateRange();
  return entry;
};

const createInventoryInput = (type) => {
  const entry = {
    blackoutDates: {},
    maxGuestCount: random.number(10),
  };
  entry[type] = random.uuid();
  entry.blackoutDates[randomRangeNumber(1, 12)] = randomDateRange();
  return entry;
};

// (function () {
//   const promises = [];
//   for (let j = 0; j < 1000; j++) {
//     const storage = [];
//     for (let i = 0; i < 10; i++) {
//       storage.push(createClientInput(hostOrExp()));
//     }
//     promises.push(transSend(storage));
//   }
//   Promise.all(promises)
//     .then(() => console.log('success!'))
//     .catch(err => console.error(err));
// })();

export { createClientInput, createInventoryInput, hostOrExp };
