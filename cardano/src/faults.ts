/**
 * Fault injection for tests of the seller's keeper. Off unless AUTO_RELEASE_FAULTS is set, for example
 *
 *   AUTO_RELEASE_FAULTS=cycle:2,fetch:2,evaluate:1
 *
 * which makes the next 2 cycles fail at the start, the next 2 data fetches fail, and the next release fail the way a blind
 * script evaluation does. Each fault fires that many times and then stops. It exists so that the failure handling (backoff,
 * isolation, retry, give-up rules) can be shown working on purpose instead of waiting for the network to misbehave.
 */
const counts = new Map<string, number>();
for (const part of (process.env.AUTO_RELEASE_FAULTS ?? "").split(",")) {
  const [name, n] = part.trim().split(":");
  if (name && Number.isInteger(Number(n)) && Number(n) > 0) counts.set(name, Number(n));
}

export const faultsLeft = (): Record<string, number> => Object.fromEntries(counts);

/** Throws once per remaining injected fault of this name; does nothing otherwise. */
export const fault = (name: string, message = `injected fault: ${name}`): void => {
  const left = counts.get(name) ?? 0;
  if (left > 0) {
    counts.set(name, left - 1);
    throw new Error(message);
  }
};
