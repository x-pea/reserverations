import mongoose from 'mongoose';
import { config } from 'dotenv';

config();

mongoose.connect(process.env.MONGO);
const { Schema } = mongoose;

const rentalListing = new Schema({
  dateAvailability: Schema.Types.Mixed,
  maxGuestCount: Number,
  rental: { type: String, index: { unique: true } },
});

const expListing = new Schema({
  dateAvailability: Schema.Types.Mixed,
  maxGuestCount: Number,
  experience: { type: String, index: { unique: true } },
});

const Rental = mongoose.model('Rental', rentalListing);
const Experience = mongoose.model('Experience', expListing);

const queryAvailability = (type, id) => {
  if (type === 'rental') {
    return Rental.findOne({ rental: id });
  }
  return Experience.findOne({ experience: id });
};

const addAvailability = (listing) => {
  if (listing.rental) {
    return new Rental({
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
  if (type === 'rental') return Rental.update({ rental: id }, { $set: updateObj });
  if (type === 'experience') return Experience.update({ experience: id }, { $set: updateObj });
};

export { Rental, Experience, addAvailability, queryAvailability, updateAvailability };
