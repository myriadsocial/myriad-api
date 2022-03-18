import {AnyObject} from '@loopback/repository';

export function formatedBalance(balance: string, decimal: number): string {
  if (balance === '0') return '0';

  let formatted = '0';
  if (balance.length < decimal + 1) {
    const correctedDecimal = decimal + 1 - balance.length;
    formatted = '0.' + '0'.repeat(correctedDecimal - 1) + balance;
  } else {
    const correctedDecimal = balance.length - decimal;
    const hasDecimal = balance.substring(correctedDecimal).replace(/0+/gi, '');
    const correctedBalance = hasDecimal
      ? '.' + balance.substring(correctedDecimal)
      : '';

    formatted = balance.substring(0, correctedDecimal) + correctedBalance;
  }

  return formatted;
}

export function parseJSON(data?: string): AnyObject | undefined {
  try {
    if (data) return JSON.parse(data);
  } catch {
    // ignore
  }
}
