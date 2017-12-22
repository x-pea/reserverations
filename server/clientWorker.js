import { writePoints } from '../databases/reservations';
import { addAvailability } from '../databases/availabilities';
import { readMessage, deleteMessage } from './sqs'

const confirmAvailability = () => {
  // load balancer worker:
  // message from client
  // query availabilities database for availability confirmation
  // send response to client
  // store new reservation into reservations database
  // delete message
}

// reservation handlers
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
export { parseReservation, saveReservation };
