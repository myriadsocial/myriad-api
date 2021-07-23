export class DateUtils {
  second: number;
  minute: number;
  hour: number;
  day: number;
  year: number;

  constructor() {
    // In miliseconds
    this.second = 1000;
    this.minute = 60 * 1000;
    this.hour = 60 * 60 * 1000;
    this.day = 24 * 60 * 60 * 1000;
    this.year = 365 * 24 * 60 * 60 * 1000;
  }

  today(date: string): number {
    return new Date().getTime() - new Date(date).getTime();
  }
}
