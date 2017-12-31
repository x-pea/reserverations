import mongoose from 'mongoose';

mongoose.connect(process.env.MONGO);
const { Schema } = mongoose;

const homeListing = new Schema({
  dateAvailability: Schema.Types.Mixed,
  maxGuestCount: Number,
  rental: { type: Number, index: { unique: true } },
});

const expListing = new Schema({
  dateAvailability: Schema.Types.Mixed,
  maxGuestCount: Number,
  experience: { type: Number, index: { unique: true } },
});

const Home = mongoose.model('Home', homeListing);
const Experience = mongoose.model('Experience', expListing);

const queryAvailability = (type, id) => {
  if (type === 'rental') {
    return Home.findOne({ rental: id });
  }
  return Experience.findOne({ experience: id });
};

const addAvailability = (listing) => {
  if (listing.rental) {
    return new Home({
      dateAvailability: listing.dateAvailability,
      maxGuestCount: listing.maxGuestCount,
      rental: listing.rental,
    }).save();
  }
  return new Experience({
    dateAvailability: listing.dateAvailability,
    maxGuestCount: listing.maxGuestCount,
    experience: listing.experience,
  }).save();
};

const updateAvailability = (type, id, month, date, newAvailability) => {
  const updateObj = {};
  updateObj[`dateAvailability.${month}.${date}`] = newAvailability;
  if (type === 'rental') return Home.update({ rental: id }, { $set: updateObj });
  if (type === 'exp') return Experience.update({ experience: id }, { $set: updateObj });
};

export { Home, Experience, addAvailability, queryAvailability, updateAvailability };
