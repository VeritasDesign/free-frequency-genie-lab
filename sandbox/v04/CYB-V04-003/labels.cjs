'use strict';

function formatLabel(label) {
  if (typeof label !== 'string') return '';
  return label;
}

module.exports = { formatLabel };
