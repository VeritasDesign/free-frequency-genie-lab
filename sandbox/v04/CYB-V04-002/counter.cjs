'use strict';

function safeCount(count) {
  if (!Number.isInteger(count) || count < 0) return 0;
  return count;
}

module.exports = { safeCount };
