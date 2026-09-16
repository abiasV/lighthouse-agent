function getErrorPolicy(error) {
  if (error.status === 429) {
    return {
      action: "RETRY",
      maxAttempts: 3,
      useBackoff: true,
    };
  }

  if (error.status === 500 || error.status === 503) {
    return {
      action: "RETRY",
      maxAttempts: 3,
      useBackoff: true,
    };
  }

  if (error.status === 400) {
    return {
      action: "FIX_INPUT",
      maxAttempts: 1,
      useBackoff: false,
    };
  }

  if (error.status === 403) {
    return {
      action: "STOP",
      maxAttempts: 0,
      useBackoff: false,
    };
  }

  return {
    action: "STOP",
    maxAttempts: 0,
    useBackoff: false,
  };
}

export default getErrorPolicy;