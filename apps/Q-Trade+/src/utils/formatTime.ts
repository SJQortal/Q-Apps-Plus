import moment from "moment";

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  // Pad the seconds with a leading zero if less than 10
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}


export function formatTimestampForum(timestamp: number): string {
  const now = moment();
  const timestampMoment = moment(timestamp);
  const elapsedTime = now.diff(timestampMoment, 'minutes');

  if (elapsedTime < 1) {
    return `Just now - ${timestampMoment.format('h:mm A')}`;
  } else if (elapsedTime < 60) {
    return `${elapsedTime}m ago - ${timestampMoment.format('h:mm A')}`;
  } else if (elapsedTime < 1440) {
    return `${Math.floor(elapsedTime / 60)}h ago - ${timestampMoment.format('h:mm A')}`;
  } else {
    return timestampMoment.format('MMM D, YYYY - h:mm A');
  }
}