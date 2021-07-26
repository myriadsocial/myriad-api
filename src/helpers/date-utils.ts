export class DateUtils {
  second = 1000;
  minute = 60 * this.second;
  hour = 60 * this.minute;
  day = 24 * this.hour;
  year = 365 * this.day;

  constructor() {}

  isToday(date: string): boolean {
    return new Date().getTime() - new Date(date).getTime() > this.day;
  }
}
