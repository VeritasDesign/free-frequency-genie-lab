'use strict';

function formatLabel(label) {
  if (typeof label !== 'string') return '';
  return label.trim().toUpperCase();
}

module.exports = { formatLabel };
