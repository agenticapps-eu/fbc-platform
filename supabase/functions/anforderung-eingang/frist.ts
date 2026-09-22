// Lässt ein Versprechen spätestens mit dem Signal scheitern (AGE-830).
//
// `fetch` bricht bei einem Signal selbst ab. Nicht jede Stelle, an der der
// Ablauf wartet, kennt aber das Signal — ein Stream-`read()`, ein Ersatz im
// Test, ein Aufruf, der den Parameter ignoriert. Die Fristen gegen ChatGPTs
// 45 s gelten nur, wenn sie an JEDER dieser Stellen greifen.

export function bisAbbruch<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  return new Promise<T>((ja, nein) => {
    if (signal.aborted) return nein(signal.reason);
    const weg = () => nein(signal.reason);
    signal.addEventListener("abort", weg, { once: true });
    p.then(ja, nein).finally(() => signal.removeEventListener("abort", weg));
  });
}
