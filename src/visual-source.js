import { cleanOCRText } from "./ocr-quality.js";
export function hasVisualSource(frames = []) {
  return frames.some((f) => {
    const text = cleanOCRText(f.ocrText || "");
    return (
      (text.match(/[\p{L}\p{M}]{2,}/gu) || []).length >= 4 ||
      /\b(?:const|function|def|class|import)\b|^\s*[A-Za-z_]\w*\s*=\s*\d/u.test(
        text,
      )
    );
  });
}
