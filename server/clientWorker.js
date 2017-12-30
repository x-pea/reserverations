import { writePoints } from '../databases/reservations';
import { queryHome, queryExperience, updateAvailability } from '../databases/availabilities';

// load balancer worker:
// message from client
// query availabilities database for availability confirmation
// send response to client
// store new reservation into reservations database
// delete message

const assignReservationId = (userId, listingId) => {
  console.log(userId, listingId)
  return `${userId.slice(0, 3)}${String(listingId).slice(0, 5)}`
}

// const isAvailable = (guestCount, dates, availability) => {
//   for (let month in dates) {
//     for (let date of dates[month]) {
//       if (availability[month][date] - guestCount < 0) {
//         return false;
//       }
//     }
//   }
//   return true;
// };
//
// const sendConfirmation = (availability) => {
//   if (availability) {
//     return {
//       availability,
//       reservationId: assignReservationId()
//     }
//   }
// }
//
// const confirmAvailability = (reservation) => {
//   if (reservation.rental) {
//     queryHome(reservation.rental)
//       .then(({ dateAvailability }) => {
//         if (isAvailable(reservation.guestCount, reservation.dates, dateAvailability)) {
//           //
//         }
//       })
//   }
//   if (reservation.experience) {}
// }

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
export { assignReservationId, parseReservation, saveReservation };
