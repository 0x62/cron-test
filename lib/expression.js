'use strict';

// Load Date class extensions
var CronDate = require('./date');

// Get Number.isNaN or the polyfill
var safeIsNaN = require('is-nan');

/**
 * Construct a new expression parser
 *
 * Options:
 *   currentDate: iterator start date
 *   endDate: iterator end date
 *
 * @constructor
 * @private
 * @param {Object} fields  Expression fields parsed values
 * @param {Object} options Parser options
 */
function CronExpression (fields, options) {
  this._options = options;
  this._utc = options.utc || false;
  this._tz = this._utc ? 'UTC' : options.tz;
  this._fields = {};
  this._isIterator = options.iterator || false;
  this._hasIterated = false;

  // Map fields
  for (var i = 0, c = CronExpression.map.length; i < c; i++) {
    var key = CronExpression.map[i];
    this._fields[key] = fields[i];
  }
}

/**
 * Field mappings
 * @type {Array}
 */
CronExpression.map = [ 'second', 'minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek' ];

/**
 * Prefined intervals
 * @type {Object}
 */
CronExpression.predefined = {
  '@yearly': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@hourly': '0 * * * *'
};

/**
 * Fields constraints
 * @type {Array}
 */
CronExpression.constraints = [
  [ 0, 59 ], // Second
  [ 0, 59 ], // Minute
  [ 0, 23 ], // Hour
  [ 1, 31 ], // Day of month
  [ 1, 12 ], // Month
  [ 0, 7 ] // Day of week
];

/**
 * Days in month
 * @type {number[]}
 */
CronExpression.daysInMonth = [
  31,
  28,
  31,
  30,
  31,
  30,
  31,
  31,
  30,
  31,
  30,
  31
];

/**
 * Field aliases
 * @type {Object}
 */
CronExpression.aliases = {
  month: {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12
  },

  dayOfWeek: {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6
  }
};

/**
 * Field defaults
 * @type {Array}
 */
CronExpression.parseDefaults = [ '*', '*', '*', '*', '*', '*' ];

/**
 * Parse input interval
 *
 * @param {String} field Field symbolic name
 * @param {String} value Field value
 * @param {Array} constraints Range upper and lower constraints
 * @return {Array} Sequence of sorted values
 * @private
 */
CronExpression._parseField = function _parseField (field, value, constraints) {
  // Replace aliases
  switch (field) {
    case 'month':
    case 'dayOfWeek':
      var aliases = CronExpression.aliases[field];

      value = value.replace(/[a-z]{1,3}/gi, function(match) {
        match = match.toLowerCase();

        if (typeof aliases[match] !== undefined) {
          return aliases[match];
        } else {
          throw new Error('Cannot resolve alias "' + match + '"')
        }
      });
      break;
  }

  // Check for valid characters.
  if (!(/^[\d|/|*|\-|,]+$/.test(value))) {
    throw new Error('Invalid characters, got value: ' + value)
  }

  // Replace '*'
  if (value.indexOf('*') !== -1) {
    value = value.replace(/\*/g, constraints.join('-'));
  }

  //
  // Inline parsing functions
  //
  // Parser path:
  //  - parseSequence
  //    - parseRepeat
  //      - parseRange

  /**
   * Parse sequence
   *
   * @param {String} val
   * @return {Array}
   * @private
   */
  function parseSequence (val) {
    var stack = [];

    function handleResult (result) {
      var max = stack.length > 0 ? Math.max.apply(Math, stack) : -1;

      if (result instanceof Array) { // Make sequence linear
        for (var i = 0, c = result.length; i < c; i++) {
          var value = result[i];

          // Check constraints
          if (value < constraints[0] || value > constraints[1]) {
            throw new Error(
                'Constraint error, got value ' + value + ' expected range ' +
                constraints[0] + '-' + constraints[1]
            );
          }

          if (value > max) {
            stack.push(value);
          }

          max = Math.max.apply(Math, stack);
        }
      } else { // Scalar value
        result = +result;

        // Check constraints
        if (result < constraints[0] || result > constraints[1]) {
          throw new Error(
            'Constraint error, got value ' + result + ' expected range ' +
            constraints[0] + '-' + constraints[1]
          );
        }

        if (field == 'dayOfWeek') {
          result = result % 7;
        }

        stack.push(result);
      }
    }

    var atoms = val.split(',');
    if (atoms.length > 1) {
      var pattern = /\D/g;
      atoms.sort(function (a, b) {
        return parseInt(a.replace(pattern, ''), 10) - parseInt(b.replace(pattern, ''), 10);
      });

      for (var i = 0, c = atoms.length; i < c; i++) {
        handleResult(parseRepeat(atoms[i]));
      }
    } else {
      handleResult(parseRepeat(val));
    }

    return stack;
  }

  /**
   * Parse repetition interval
   *
   * @param {String} val
   * @return {Array}
   */
  function parseRepeat (val) {
    var repeatInterval = 1;
    var atoms = val.split('/');

    if (atoms.length > 1) {
      return parseRange(atoms[0], atoms[atoms.length - 1]);
    }

    return parseRange(val, repeatInterval);
  }

  /**
   * Parse range
   *
   * @param {String} val
   * @param {Number} repeatInterval Repetition interval
   * @return {Array}
   * @private
   */
  function parseRange (val, repeatInterval) {
    var stack = [];
    var atoms = val.split('-');

    if (atoms.length > 1 ) {
      // Invalid range, return value
      if (atoms.length < 2 || !atoms[0].length) {
        return +val;
      }

      // Validate range
      var min = +atoms[0];
      var max = +atoms[1];

      if (safeIsNaN(min) || safeIsNaN(max) ||
          min < constraints[0] || max > constraints[1]) {
        throw new Error(
          'Constraint error, got range ' +
          min + '-' + max +
          ' expected range ' +
          constraints[0] + '-' + constraints[1]
        );
      } else if (min >= max) {
        throw new Error('Invalid range: ' + val);
      }

      // Create range
      var repeatIndex = +repeatInterval;

      if (safeIsNaN(repeatIndex) || repeatIndex <= 0) {
        throw new Error('Constraint error, cannot repeat at every ' + repeatIndex + ' time.');
      }

      for (var index = min, count = max; index <= count; index++) {
        if (repeatIndex > 0 && (repeatIndex % repeatInterval) === 0) {
          repeatIndex = 1;
          stack.push(index);
        } else {
          repeatIndex++;
        }
      }

      return stack;
    }

    return +val;
  }

  return parseSequence(value);
};

/**
 * Test a date against the cron expression
 * 
 * @return {Boolean}
 */
CronExpression.prototype.test = function test (inputDate) {

  /**
   * Match field value
   *
   * @param {String} value
   * @param {Array} sequence
   * @return {Boolean}
   * @private
   */
  function matchSchedule (value, sequence) {
    for (var i = 0, c = sequence.length; i < c; i++) {
      if (sequence[i] >= value) {
        return sequence[i] === value;
      }
    }

    return sequence[0] === value;
  }

  /**
   * Detect if input range fully matches constraint bounds
   * @param {Array} range Input range
   * @param {Array} constraints Input constraints
   * @returns {Boolean}
   * @private
   */
  function isWildcardRange (range, constraints) {
    if (range instanceof Array && !range.length) {
      return false;
    }

    if (constraints.length !== 2) {
      return false;
    }

    return range.length === (constraints[1] - (constraints[0] < 1 ? - 1 : 0));
  }

  var currentDate = new CronDate(inputDate);
  // Find matching schedule
  var initial_ts = currentDate.getTime();

  // Day of month and week matching:
  //
  // "The day of a command's execution can be specified by two fields --
  // day of month, and day of week.  If  both  fields  are  restricted  (ie,
  // aren't  *),  the command will be run when either field matches the cur-
  // rent time.  For example, "30 4 1,15 * 5" would cause a command to be
  // run at 4:30 am on the  1st and 15th of each month, plus every Friday."
  //
  // http://unixhelp.ed.ac.uk/CGI/man-cgi?crontab+5
  //

  var dayOfMonthMatch = matchSchedule(currentDate.getDate(), this._fields.dayOfMonth);
  var dayOfWeekMatch = matchSchedule(currentDate.getDay(), this._fields.dayOfWeek);

  var isDayOfMonthWildcardMatch = isWildcardRange(this._fields.dayOfMonth, CronExpression.constraints[3]);
  var isMonthWildcardMatch = isWildcardRange(this._fields.month, CronExpression.constraints[4]);
  var isDayOfWeekWildcardMatch = isWildcardRange(this._fields.dayOfWeek, CronExpression.constraints[5]);

  // Validate days in month if explicit value is given
  if (!isMonthWildcardMatch) {
    var currentYear = currentDate.getFullYear();
    var currentMonth = currentDate.getMonth() + 1;
    var previousMonth = currentMonth === 1 ? 11 : currentMonth - 1;
    var daysInPreviousMonth = CronExpression.daysInMonth[previousMonth - 1];
    var daysOfMontRangeMax = this._fields.dayOfMonth[this._fields.dayOfMonth.length - 1];

    var _daysInPreviousMonth = daysInPreviousMonth;
    var _daysOfMontRangeMax = daysOfMontRangeMax;

    // Handle leap year
    var isLeap = !((currentYear % 4) || (!(currentYear % 100) && (currentYear % 400)));
    if (isLeap) {
      _daysInPreviousMonth = 29;
      _daysOfMontRangeMax = 29;
    }

    if (previousMonth === 2 && this._fields.month[0] === previousMonth && _daysInPreviousMonth < _daysOfMontRangeMax) {
      throw new Error('Invalid explicit day of month definition');
    }
  }

  // Add or subtract day if select day not match with month (according to calendar)
  if (!dayOfMonthMatch && !dayOfWeekMatch) {
    return false;
  }

  // Add or subtract day if not day of month is set (and no match) and day of week is wildcard
  if (!isDayOfMonthWildcardMatch && isDayOfWeekWildcardMatch && !dayOfMonthMatch) {
    return false;
  }

  // Add or subtract day if not day of week is set (and no match) and day of month is wildcard
  if (isDayOfMonthWildcardMatch && !isDayOfWeekWildcardMatch && !dayOfWeekMatch) {
    return false;
  }

  // Add or subtract day if day of month and week are non-wildcard values and both doesn't match
  if (!(isDayOfMonthWildcardMatch && isDayOfWeekWildcardMatch) &&
      !dayOfMonthMatch && !dayOfWeekMatch) {
    return false;
  }

  // Match month
  if (!matchSchedule(currentDate.getMonth() + 1, this._fields.month)) {
    return false;
  }

  // Match hour
  if (!matchSchedule(currentDate.getHours(), this._fields.hour)) {
    return false;
  }

  // Match minute
  if (!matchSchedule(currentDate.getMinutes(), this._fields.minute)) {
    return false;
  }

  // Match second
  if (!matchSchedule(currentDate.getSeconds(), this._fields.second)) {
    return false;
  }

  return true

}

/**
 * Parse input expression (async)
 *
 * @public
 * @param {String} expression Input expression
 * @param {Object} [options] Parsing options
 * @param {Function} [callback]
 */
CronExpression.parse = function parse (expression, options, callback) {
  var self = this;
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  function parse (expression, options) {
    if (!options) {
      options = {};
    }

    if (typeof options.currentDate === 'undefined') {
      options.currentDate = new CronDate(undefined, self._tz);
    }

    // Is input expression predefined?
    if (CronExpression.predefined[expression]) {
      expression = CronExpression.predefined[expression];
    }

    // Split fields
    var fields = [];
    var atoms = (expression + '').trim().split(/\s+/);

    // Resolve fields
    var start = (CronExpression.map.length - atoms.length);
    for (var i = 0, c = CronExpression.map.length; i < c; ++i) {
      var field = CronExpression.map[i]; // Field name
      var value = atoms[atoms.length > c ? i : i - start]; // Field value

      if (i < start || !value) {
        fields.push(CronExpression._parseField(
          field,
          CronExpression.parseDefaults[i],
          CronExpression.constraints[i])
        );
      } else { // Use default value
        fields.push(CronExpression._parseField(
          field,
          value,
          CronExpression.constraints[i])
        );
      }
    }

    return new CronExpression(fields, options);
  }

  return parse(expression, options);
};

module.exports = CronExpression;
