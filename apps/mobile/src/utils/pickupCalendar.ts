import type { PickupAvailability } from "@/types/domain";

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatCalendarDate(dateIso: string) {
  const date = new Date(`${dateIso}T12:00:00`);

  return {
    dayName: dayLabels[date.getDay()],
    label: `${dayLabels[date.getDay()]} ${date.getMonth() + 1}/${date.getDate()}`,
  };
}

export function isPickupDateAvailable(
  dateIso: string,
  availability: PickupAvailability,
) {
  const date = new Date(`${dateIso}T12:00:00`);
  const weekday = date.getDay();

  return (
    availability.availableWeekdays.includes(weekday) &&
    !availability.unavailableDates.includes(dateIso)
  );
}

export function isDateAfter(dateIso: string, comparisonDateIso: string) {
  return dateIso > comparisonDateIso;
}

export function buildPickupCalendar(
  availability: PickupAvailability,
  daysToShow = 14,
) {
  const today = new Date();

  return Array.from({ length: daysToShow }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index + 1);

    const dateIso = toIsoDate(date);
    const formatted = formatCalendarDate(dateIso);

    return {
      dateIso,
      dayName: formatted.dayName,
      label: formatted.label,
      available: isPickupDateAvailable(dateIso, availability),
    };
  });
}
