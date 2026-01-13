function isLocalhostUrl(url) {
  try {
    const hostname = url.hostname.toLowerCase();

    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

module.exports = { isLocalhostUrl };