'use strict';

function safeCount(count) {
  if (!Number.isInteger(count) || count < 0) return 0;
  return Math.min(count, 5);
}

module.exports = { safeCount };
