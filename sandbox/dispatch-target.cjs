'use strict';

const EMPTY_GREETING = 'Systems ready.';

function dispatchGreeting(name) {
  if (typeof name !== 'string' || !name.trim()) return EMPTY_GREETING;
  return `Ready, ${name.trim()}.`;
}

module.exports = { dispatchGreeting };
