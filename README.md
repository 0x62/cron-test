cron-test
================

Simple utility to check whether a date matches a cron expression.

Butchered from [cron-parser](https://github.com/harrisiirak/cron-parser).

Setup
========
```bash
npm install cron-test
```

Supported format
========

```
*    *    *    *    *    *
┬    ┬    ┬    ┬    ┬    ┬
│    │    │    │    │    |
│    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
│    │    │    │    └───── month (1 - 12)
│    │    │    └────────── day of month (1 - 31)
│    │    └─────────────── hour (0 - 23)
│    └──────────────────── minute (0 - 59)
└───────────────────────── second (0 - 59, optional)
```

Supports mixed use of ranges and range increments (L, W and # characters are not supported currently). See below for example

Usage
========

Simple expression.

```javascript
const test = require('cron-test');

// Every hour from 0 through 9 and 23 on every day-of-week from Monday through Friday
const interval = test.parseExpression('* 0-9,23 * * 1-5');
const date1 = new Date('2017-12-06T08:13:42.770Z');
const date2 = new Date('2017-12-06T12:13:42.770Z');

interval.test(date1) // true
interval.test(date2) // false

```