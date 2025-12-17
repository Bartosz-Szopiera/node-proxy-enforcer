function isValidProxyUrl(value) {
  if (!value) return false;

  // Must start with http:// or https:// and end with :PORT
  const regex = /^https?:\/\/.+:\d+$/i;
  return regex.test(value);
}

module.exports = { isValidProxyUrl };