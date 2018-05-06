import { Injectable, Optional } from '@angular/core';
import { TimeagoIntl } from './timeago.intl';
import { MINUTE, HOUR, DAY, WEEK, MONTH, YEAR } from './util';

export type Unit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

export type Suffix = 'ago' | 'from now' | '';

export type StringOrFn = ((value: number, millisDelta:  number) => string) | string;

export type NumberArray = [ string, string, string, string, string, string, string, string, string, string ];

export abstract class TimeagoFormatter {
  constructor(@Optional() protected intl: TimeagoIntl) {}

  parse(then: number, hasSuffix: boolean): string {
    const now = Date.now();
    const seconds = Math.round(Math.abs(now - then) / 1000);
    const suffix = hasSuffix ? then < now ? 'ago' : 'from now' : '';

    const [value, unit] =
      seconds < MINUTE
        ? [Math.round(seconds), 'second']
        : seconds < HOUR
          ? [Math.round(seconds / MINUTE), 'minute']
          : seconds < DAY
            ? [Math.round(seconds / HOUR), 'hour']
            : seconds < WEEK
              ? [Math.round(seconds / DAY), 'day']
              : seconds < MONTH
                ? [Math.round(seconds / WEEK), 'week']
                : seconds < YEAR
                  ? [Math.round(seconds / MONTH), 'month']
                  : [Math.round(seconds / YEAR), 'year'];

    return this.format(value, unit, suffix);
  }

  protected abstract format(value: number, unit: string, suffix: string, now?: number, then?: number): string;
}

@Injectable()
export class TimeagoDefaultFormatter extends TimeagoFormatter {
  format(value: number, unit: string, suffix: string): string {
    if (value !== 1) {
      unit += 's';
    }
    return value + ' ' + unit + ' ' + suffix;
  }
}

@Injectable()
export class TimeagoCustomFormatter extends TimeagoFormatter {
  format(value: number, unit: Unit, suffix: Suffix, now: number, then: number) {
    /** convert weeks to days if strings don't handle weeks */
    if (unit === 'week' && !this.intl.week && !this.intl.weeks) {
      const days = Math.round(Math.abs(now - then) / (1000 * 60 * 60 * 24));
      value = days;
      unit = 'day';
    }

    /** create a normalize function for given value */
    const normalize = this.normalizeFn(value, now - then, this.intl.numbers);

    /** The eventual return value stored in an array so that the wordSeparator can be used */
    const dateString: string[] = [];

    /** handle prefixes */
    if (suffix === 'ago' && this.intl.prefixAgo) {
      dateString.push(normalize(this.intl.prefixAgo));
    }
    if (suffix === 'from now' && this.intl.prefixFromNow) {
      dateString.push(normalize(this.intl.prefixFromNow));
    }

    /** Handle Main number and unit */
    const isPlural = value > 1;
    if (isPlural) {
      const stringFn: StringOrFn = this.intl[unit + 's'] || this.intl[unit] || '%d ' + unit;
      dateString.push(normalize(stringFn));
    } else {
      const stringFn: StringOrFn = this.intl[unit] || this.intl[unit + 's'] || '%d ' + unit;
      dateString.push(normalize(stringFn));
    }

    /** Handle Suffixes */
    if (suffix === 'ago' && this.intl.suffixAgo) {
      dateString.push(normalize(this.intl.suffixAgo));
    }
    if (suffix === 'from now' && this.intl.suffixFromNow) {
      dateString.push(normalize(this.intl.suffixFromNow));
    }

    /** join the array into a string and return it */
    const wordSeparator = typeof this.intl.wordSeparator === 'string' ? this.intl.wordSeparator : ' ';
    return dateString.join(wordSeparator);
  }

  /**
   * If the numbers array is present, format numbers with it,
   * otherwise just cast the number to a string and return it
  */
  private normalizeNumber(numbers: NumberArray, value: number) {
    return numbers && numbers.length === 10
      ? String(value).split('')
          .map((digit: string) => digit.match(/^[0-9]$/) ? numbers[parseInt(digit, 10)] : digit)
          .join('')
      : String(value);
  }

  /**
   * Take a string or a function that takes number of days and returns a string
   * and provide a uniform API to create string parts
  */
  private normalizeFn(value: number, millisDelta: number, numbers?: NumberArray) {
    return (stringOrFn: StringOrFn) =>
      typeof stringOrFn === 'function'
      ? stringOrFn(value, millisDelta).replace(/%d/g, this.normalizeNumber(numbers, value))
      : stringOrFn.replace(/%d/g, this.normalizeNumber(numbers, value));
  }
}
