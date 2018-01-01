import { writePoints } from '../databases/reservations';
import { queryAvailability, updateAvailability } from '../databases/availabilities';

// Confirmation availability for reservation
const determineType = reservation => reservation.rental ? 'rental' : 'experience';
const assignReservationId = (userId, listingId) => `${userId.slice(0, 3)}${String(listingId).slice(0, 5)}`;

const checkAvail = (guestCount, dates, availability, maxGuestCount) => {
  const newAvail = {};
  const months = Object.keys(dates);
  let isAvailable = true;

  months.forEach((month) => {
    newAvail[month] = {};
    dates[month].forEach((date) => {
      let dateAvailability = availability[month][date];
      if (dateAvailability === null || undefined) {
        dateAvailability = maxGuestCount;
      }
      newAvail[month][date] = dateAvailability - guestCount;
      if (newAvail[month][date] < 0) {
        isAvailable = false;
      }
    });
  });
  return isAvailable ? newAvail : isAvailable;
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

// updated availability that will be sent to inventory
const writeUpdate = (type, listingId, isAvailable, availability) =>  {
  const updatedAvailability = {
    dates: {},
  };
  updatedAvailability[type] = listingId;
  const months = Object.keys(isAvailable);

  months.forEach((month) => {
    updatedAvailability.dates[month] = availability[month];
  });
  return updatedAvailability;
  // send to inventory depending on type
  // type === 'rental' ? /rentalsqs : /experiencesqs
};

const parseReservation = (reservation) => {
  const type = determineType(reservation);
  const entry = {
    measurement: type,
    tags: {
      userId: reservation.userId,
      reservationId: assignReservationId(reservation.userId, reservation[type]),
    },
    fields: {
      dates: JSON.stringify(reservation.dates),
      guestCount: reservation.guestCount,
      count: 1,
    },
  };
  entry.tags[type] = reservation[type];
  if (type === 'rental') {
    entry.tags.experienceShown = reservation.experienceShown;
  }
  return entry;
};

// Transposes data and sends it to the database
const saveReservation = (reservations) => {
  const reservationEntries = reservations.map((reservation) => {
    return parseReservation(reservation);
  });
  return writePoints(reservationEntries, 'reservations');
};

const updateAvailabilities = (type, id, newAvailability) => {
  const months = Object.keys(newAvailability);
  months.forEach((month) => {
    const dates = Object.keys(newAvailability[month]);
    dates.forEach((date) => {
      Promise.resolve(updateAvailability(type, id, month, date, newAvailability[month][date]))
    });
  });
};

const confirmAvailability = (reservation) => {
  const type = determineType(reservation);
  const id = reservation[type];

  return queryAvailability(type, id)
    .then(({ dateAvailability, maxGuestCount }) => {
      const isAvailable = checkAvail(
        reservation.guestCount,
        reservation.dates,
        dateAvailability,
        maxGuestCount
      );
      if (isAvailable) {
        updateAvailabilities(type, id, isAvailable)
        saveReservation([reservation])
          .then(() => writeUpdate(type, reservation[type], isAvailable, dateAvailability))
          .catch(err => console.error('Error updating availabilities', err));
      }
      return writeResponse(isAvailable, reservation.userId, reservation[type]);
    });
};

// Exports for testing
export { assignReservationId, checkAvail, parseReservation, saveReservation, updateAvailabilities, confirmAvailability };
