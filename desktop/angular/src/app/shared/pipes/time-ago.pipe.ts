import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timeAgo',
  pure: true
})
export class TimeAgoPipe implements PipeTransform {
  transform(value: number | Date | string, ticker?: any): string {
    return timeAgo(value);
  }
}

export const timeCeilings = [
  { ceiling: 1, text: "" },
  { ceiling: 60, text: "sec" },
  { ceiling: 3600, text: "min" },
  { ceiling: 86400, text: "hour" },
  { ceiling: 2629744, text: "day" },
  { ceiling: 31556926, text: "month" },
  { ceiling: Infinity, text: "year" }
]

const timeLabels = {
  sec: [$localize`:@@time.sec.one:sec`, $localize`:@@time.sec.many:secs`],
  min: [$localize`:@@time.min.one:min`, $localize`:@@time.min.many:mins`],
  hour: [$localize`:@@time.hour.one:hour`, $localize`:@@time.hour.many:hours`],
  day: [$localize`:@@time.day.one:day`, $localize`:@@time.day.many:days`],
  month: [$localize`:@@time.month.one:month`, $localize`:@@time.month.many:months`],
  year: [$localize`:@@time.year.one:year`, $localize`:@@time.year.many:years`],
}

export function timeAgo(value: number | Date | string) {
  if (typeof value === 'string') {
    value = new Date(value)
  }

  if (value instanceof Date) {
    value = value.valueOf() / 1000;
  }

  let suffix = 'ago'

  let diffInSeconds = Math.floor(((new Date()).valueOf() - (value * 1000)) / 1000);
  if (diffInSeconds < 0) {
    diffInSeconds = diffInSeconds * -1;
    suffix = ''
  }

  for (let i = timeCeilings.length - 1; i >= 0; i--) {
    const f = timeCeilings[i];
    let n = Math.floor(diffInSeconds / f.ceiling);
    if (n > 0) {
      if (i < 1) {
        return suffix ? $localize`:@@time.lessMinutePast:< 1 min ago` : $localize`:@@time.lessMinuteFuture:< 1 min`;
      }
      const unit = timeCeilings[i + 1].text as keyof typeof timeLabels;
      const text = timeLabels[unit][n > 1 ? 1 : 0];
      return suffix ? $localize`:@@time.past:${n}:count: ${text}:unit: ago` : $localize`:@@time.future:${n}:count: ${text}:unit:`
    }
  }

  return suffix ? $localize`:@@time.lessMinutePast:< 1 min ago` : $localize`:@@time.lessMinuteFuture:< 1 min` // actually just now (diffInSeconds == 0)
}
