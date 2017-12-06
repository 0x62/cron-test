'use strict';

var moment = require('moment-timezone');

CronDate.prototype.getDate = function() {
  return this._date.date();
};

CronDate.prototype.getFullYear = function() {
  return this._date.year();
};

CronDate.prototype.getDay = function() {
  return this._date.day();
};

CronDate.prototype.getMonth = function() {
  return this._date.month();
};

CronDate.prototype.getHours = function() {
  return this._date.hours();
};

CronDate.prototype.getMinutes = function() {
  return this._date.minute();
};

CronDate.prototype.getSeconds = function() {
  return this._date.second();
};

CronDate.prototype.getMilliseconds = function() {
  return this._date.millisecond();
};

CronDate.prototype.getTime = function() {
  return this._date.valueOf();
};

CronDate.prototype.getUTCDate = function() {
  return this._getUTC().date();
};

CronDate.prototype.getUTCFullYear = function() {
  return this._getUTC().year();
};

CronDate.prototype.getUTCDay = function() {
  return this._getUTC().day();
};

CronDate.prototype.getUTCMonth = function() {
  return this._getUTC().month();
};

CronDate.prototype.getUTCHours = function() {
  return this._getUTC().hours();
};

CronDate.prototype.getUTCMinutes = function() {
  return this._getUTC().minute();
};

CronDate.prototype.getUTCSeconds = function() {
  return this._getUTC().second();
};

CronDate.prototype.toISOString = function() {
  return this._date.toISOString();
};

CronDate.prototype.toJSON = function() {
  return this._date.toJSON();
};

CronDate.prototype.getTime = function() {
  return this._date.valueOf();
};

CronDate.prototype._getUTC = function() {
  return moment.utc(this._date);
};

CronDate.prototype.toString = function() {
  return this._date.toString();
};

CronDate.prototype.toDate = function() {
  return this._date.toDate();
};

function CronDate (timestamp, tz) {
  if (timestamp instanceof CronDate) {
    timestamp = timestamp._date;
  }

  if (!tz) {
    this._date = moment(timestamp);
  } else {
    this._date = moment.tz(timestamp, tz);
  }
}

module.exports = CronDate;
