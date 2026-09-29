import moment from 'moment'

export function formatTimestamp(timestamp: number): string {
  const now = moment()
  const timestampMoment = moment(timestamp)
  const elapsedTime = now.diff(timestampMoment, 'minutes')

  if (elapsedTime < 1) {
    return 'Just now'
  } else if (elapsedTime < 60) {
    return `${elapsedTime}m`
  } else if (elapsedTime < 1440) {
    return `${Math.floor(elapsedTime / 60)}h`
  } else {
    return timestampMoment.format('MMM D')
  }
}

export const formatDate = (unixTimestamp: number): string => {
  const date = moment(unixTimestamp, 'x').fromNow()

  return date
}



export function formatEmailDate(timestamp: number) {
    const date = moment(timestamp);
    const now = moment();

    if (date.isSame(now, 'day')) {
        // If the email was received today, show the time
        return date.format('h:mm A');
    } else if (date.isSame(now, 'year')) {
        // If the email was received this year, show the month and day
        return date.format('MMM D');
    } else {
        // For older emails, show the full date
        return date.format('MMM D, YYYY');
    }
}

export function formatFullTimestamp(
  timestamp: number | string | undefined | null
): string {
  const numericTimestamp = Number(timestamp)
  if (!Number.isFinite(numericTimestamp)) {
    return "-"
  }

  return moment(numericTimestamp).format("YYYY-MM-DD HH:mm:ss")
}
