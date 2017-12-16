import { writePoints } from '../databases/reservations';

const transposeInput = (reservation) => {
  if ('rental' in reservation) {
    return {
      measurement: 'home',
      tags: {
        experienceShown: reservation.experienceShown,
        userID: reservation.userID,
        rental: reservation.rental,
      },
      fields: {
        dates: JSON.stringify(reservation.dates),
        guestCount: reservation.guestCount,
      },
    };
  }
  if ('experience' in reservation) {
    return {
      measurement: 'experience',
      tags: {
        userID: reservation.userID,
        experience: reservation.experience,
      },
      fields: {
        dates: JSON.stringify(reservation.dates),
        guestCount: reservation.guestCount,
      },
    };
  }
};

// Transposes data and sends it to the database
const transSend = (reservations) => {
  const reservationEntries = reservations.map((reservation) => {
    return transposeInput(reservation);
  });
  return writePoints(reservationEntries, 'reservations');
};

// Exports for testing
exports.transposeInput = transposeInput;
exports.transSend = transSend;
