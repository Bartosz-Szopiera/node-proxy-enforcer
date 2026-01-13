function extractUrl(args, isHttps) {
  const first = args[0];

  // Case: string URL
  if (typeof first === "string") {
    return new URL(first);
  }

  // Case: URL object
  if (first instanceof URL) {
    return first;
  }

  // Case: options object
  if (typeof first === "object") {
    const protocol =
      first.protocol ||
      (isHttps ? "https:" : "http:");

    const hostname =
      first.hostname ||
      first.host ||
      "localhost";

    const port = first.port ? `:${first.port}` : "";

    const path = first.path || first.pathname || "/";

    return new URL(`${protocol}//${hostname}${port}${path}`);
  }

  return null;
}

function extractUrlForFetch(input) {
  // Case: string URL
  if (typeof input === "string") {
    return new URL(input);
  }

  // Case: URL object
  if (input instanceof URL) {
    return input;
  }

  return null;
}

module.exports = {
  extractUrl,
  extractUrlForFetch
};
