function isValidProxyUrl(value) {
  if (!value) return false;

  // Must start with http:// or https:// and end with :PORT
  const regex = /^https?:\/\/.+:\d+$/i;
  return regex.test(value);
}

function isValidPacUrl(value) {
  if (!value) return false;

  // Accept common PAC URI forms:
  // - http(s)://...
  // - file:///...
  // - pac+http(s)://..., pac+file:///...
  // - allow optional trailing '+' (some examples show it)
  const regex = /^(?:pac\+)?(?:https?:\/\/.+|file:\/\/\/.+)\+?$/i;
  return regex.test(value);
}

module.exports = { isValidProxyUrl, isValidPacUrl };