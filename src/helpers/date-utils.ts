export class DateUtils {
  second: number;
  minute: number;
  hour: number;
  day: number;
  year: number;

  constructor() {
    // In miliseconds
    this.second = 1000;
    this.minute = 60 * this.second;
    this.hour = 60 * this.minute;
    this.day = 24 * this.hour;
    this.year = 365 * this.day;
  }

  today(date: string): number {
    return new Date().getTime() - new Date(date).getTime();
  }
}
