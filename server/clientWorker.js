import { writePoints } from '../databases/reservations';
import { queryHome, queryExperience, updateAvailability } from '../databases/availabilities';

// load balancer worker:
// message from client
// query availabilities database for availability confirmation
// send response to client
// store new reservation into reservations database
// delete message

// Confirmation availability for reservation
const assignReservationId = (userId, listingId) => {
  return `${userId.slice(0, 3)}${String(listingId).slice(0, 5)}`
};

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

const sendConfirmation = (availability) => {
  if (availability instanceof Object) {
    return {
      availability: true,
      reservationId: assignReservationId(),
    };
  }
};

const confirmAvailability = (reservation) => {
  if (reservation.rental) {
    queryHome(reservation.rental)
      .then(({ dateAvailability }) => {
        if (isAvailable(reservation.guestCount, reservation.dates, dateAvailability)) {
          //
        }
      })
  }
  if (reservation.experience) {}
}

// Store Reservation
const parseReservation = (reservation) => {
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
        count: 1,
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
        count: 1,
      },
    };
  }
};

// Transposes data and sends it to the database
const saveReservation = (reservations) => {
  const reservationEntries = reservations.map((reservation) => {
    return parseReservation(reservation);
  });
  return writePoints(reservationEntries, 'reservations');
};

// Exports for testing
export { assignReservationId, checkAvail, parseReservation, saveReservation };
