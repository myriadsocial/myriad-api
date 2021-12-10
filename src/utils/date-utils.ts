export class DateUtils {
  public readonly second = 1000;
  public readonly minute = 60 * this.second;
  public readonly hour = 60 * this.minute;
  public readonly day = 24 * this.hour;
  public readonly year = 365 * this.day;

  public isToday(date: string): boolean {
    if (!date) return false;
    return new Date().getTime() - new Date(date).getTime() > this.day;
  }
}
