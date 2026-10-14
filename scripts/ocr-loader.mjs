// Classify only Tesseract's known skipped-line diagnostics. Real warnings and
// exceptions keep their original reporting and execution behavior.
export function wrapBrowserCore(source) {
  return (
    source +
    `
;(() => {
  const core = globalThis.TesseractCore;
  globalThis.TesseractCore = (options = {}) => core({
    ...options,
    printErr: (...messages) => {
      const text = String(messages[0] || "").trim();
      if (/^Image too small to scale!! \\(/.test(text) || text === "Line cannot be recognized!!") {
        console.info("YTMind OCR: skipped an unreadable line fragment.", ...messages);
      } else {
        (options.printErr || console.warn.bind(console))(...messages);
      }
    },
  });
})();
`
  );
}
