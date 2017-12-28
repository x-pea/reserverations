import Promise from 'bluebird';
import mongoose from 'mongoose';

mongoose.connect(process.env.MONGO);
const { Schema } = mongoose;

const homeListing = new Schema({
  dates: Schema.Types.Mixed,
  maxGuestCount: Number,
  rental: { type: Number, index: { unique: true } },
});

const expListing = new Schema({
  dates: Schema.Types.Mixed,
  maxGuestCount: Number,
  experience: { type: Number, index: { unique: true } },
});

const Home = mongoose.model('Home', homeListing);
const Experience = mongoose.model('Experience', expListing);

const addHome = ({ rental, dates, maxGuestCount }) => {
  const newEntry = new Home({
    dates,
    maxGuestCount,
    rental,
  });
  return newEntry.save();
};

const addExp = ({ experience, dates, maxGuestCount }) => {
  const newEntry = new Experience({
    dates,
    maxGuestCount,
    experience,
  });
  return newEntry.save();
};

const queryHome = id => Home.findOne({ rental: id });
const queryExperience = id => Experience.findOne({ experience: id });

const updateAvailability = (type, id, month, date, newAvailability) => {
  const updateObj = {};
  updateObj[`dates.${month}.${date}`] = newAvailability;
  if (type === 'home') return Home.update({ rental: id }, { $set: updateObj });
  if (type === 'exp') return Experience.update({ experience: id }, { $set: updateObj });
};

export { Home, Experience, addHome, addExp, queryHome, queryExperience, updateAvailability };
