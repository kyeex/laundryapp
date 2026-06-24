export function formatDisplayDate(dateIso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return dateIso;
  }

  const [year, month, day] = dateIso.split("-");

  return `${month}/${day}/${year}`;
}

export function formatDisplayDateTime(value: Date | null) {
  if (!value) {
    return "Pending timestamp";
  }

  const day = `${value.getDate()}`.padStart(2, "0");
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const year = value.getFullYear();
  const time = value.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${month}/${day}/${year} ${time}`;
}
