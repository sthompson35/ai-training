/**
 * Browser-side execution helper.
 * Provider-specific calls should be injected rather than hardcoded.
 */
export async function runHybridAI({
  input,
  taskType,
  runClient,
  runServer,
  localLimit = 12000,
  timeoutMs = 30000,
}) {
  if (typeof input !== "string" || input.length === 0) {
    throw new TypeError("input must be a non-empty string");
  }

  const localEligible =
    input.length <= localLimit &&
    ["summarization", "translation", "proofreading", "rephrasing"].includes(taskType);

  if (!navigator.onLine && localEligible) {
    return withNormalizedResult(await runClient(input), "client", true);
  }

  try {
    return await withTimeout(
      Promise.resolve(runServer(input)).then((value) =>
        withNormalizedResult(value, "server", false),
      ),
      timeoutMs,
    );
  } catch (serverError) {
    if (localEligible) {
      return withNormalizedResult(await runClient(input), "client", true);
    }
    throw serverError;
  }
}

function withNormalizedResult(value, executionMode, degradedMode) {
  const text = typeof value === "string" ? value : value?.text;
  if (typeof text !== "string") {
    throw new TypeError("AI provider returned an invalid result");
  }
  return {
    success: true,
    text,
    execution_mode: executionMode,
    degraded_mode: degradedMode,
  };
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("AI request timed out")), timeoutMs),
    ),
  ]);
}
