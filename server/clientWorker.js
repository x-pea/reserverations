import { writePoints } from '../databases/reservations';
import { queryAvailability, updateAvailability } from '../databases/availabilities';

// load balancer worker:
// message from client
// query availabilities database for availability confirmation
// send response to client
// store new reservation into reservations database
// delete message

// Confirmation availability for reservation
const determineType = reservation => reservation.rental ? 'rental' : 'experience';
const assignReservationId = (userId, listingId) => `${userId.slice(0, 3)}${String(listingId).slice(0, 5)}`;

const checkAvail = (guestCount, dates, availability) => {
  const months = Object.keys(dates);
  let isAvailable = true;

  months.forEach((month) => {
    dates[month].forEach((date) => {
      availability[month][date] = availability[month][date] - guestCount;
      if (availability[month][date] < 0) {
        isAvailable = false;
      }
    });
  });
  return isAvailable ? availability : isAvailable;
};

const writeResponse = (availability, userId, listingId) => {
  if (availability instanceof Object) {
    return {
      available: true,
      reservationId: assignReservationId(userId, listingId),
    };
  }
  return { available: false };
};

const parseReservation = (reservation) => {
  const type = determineType(reservation);
  const entry = {
    measurement: type,
    tags: {
      userID: reservation.userID,
    },
    fields: {
      dates: JSON.stringify(reservation.dates),
      guestCount: reservation.guestCount,
      count: 1,
    },
  };
  entry.tags[type] = reservation[type];
  type === 'rental' ? entry.tags.experienceShown = reservation.experienceShown : null;
  return entry;
};

// Transposes data and sends it to the database
const saveReservation = (reservations) => {
  const reservationEntries = reservations.map((reservation) => {
    return parseReservation(reservation);
  });
  return writePoints(reservationEntries, 'reservations');
};

// const x = (reservation) => {
//   const type = determineType(reservation);
//
//   queryAvailability(reservation[type])
//   .then(({ dateAvailability }) => {
//     const avail = checkAvail(reservation.guestCount, reservation.dates, dateAvailability);
//     const confirmation = writeResponse(avail, reservation.userId, reservation[type]);
//     // resepond to client with confirmation
//     // update database with new availability
//     saveReservation(reservation); // returns promise
//   });
// }

// Exports for testing
export { assignReservationId, checkAvail, parseReservation, saveReservation };
