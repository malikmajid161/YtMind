# Video coverage and confidence

Updated 14 October 2026. These are processing paths, not guarantees of transcription accuracy or complete video understanding.

| Type                                 | Primary input                                                           | Recovery and limits                                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Captioned lecture/tutorial           | Captions plus frames                                                    | Imported subtitles or full audio if captions fail; deep notes and batched lecture processing                          |
| Captionless lecture/podcast          | Full audio from a pasted public link, uploaded audio, or live tab audio | Timestamped ASR; overlapping speakers, accents and terminology require review; no speaker diarization                 |
| Static-image naat/kalam/Art Track    | Audio transcription in original language                                | Urdu mode supported; melodic delivery can omit or hallucinate words. Artwork is separate contextual evidence          |
| Coding tutorial                      | Narration plus locally OCR'd code frames                                | Exact source code candidates saved/exported; missing lines and syntax corrections are not invented                    |
| Silent visual tutorial               | Readable captured/uploaded frames                                       | OCR-based evidence; no audio means no ASR source. Pasted audio-only ingestion does not index the entire visual stream |
| Mathematics/diagrams                 | Narration and readable labels                                           | OCR does not reconstruct arbitrary diagrams or verify mathematics                                                     |
| News, commentary, documentary        | Audio/captions and captured text                                        | Source claims remain distinct from independently verified facts                                                       |
| Music without intelligible words     | Artwork/context only                                                    | No-speech response stays unavailable; words are not fabricated from image text                                        |
| Live stream                          | Watching capture in the extension                                       | No completed-video link import; only observed windows, normal-speed audio and capture limits                          |
| Private, age-restricted, unavailable | User-authorized own source or accessible watched tab                    | Local link retrieval can fail; access restrictions are not bypassed                                                   |

SAGE labels supported, uncertain, conflicting or unchecked describe source support, not truth. Invalid answer citations downgrade a supported label. Rate limits receive bounded retries; unresolved checks stay unchecked. Low OCR confidence, partial ingestion, retrieval coverage and skipped live audio must remain visible.

The native tab-audio worker uses official Chrome APIs without a recurring sharing chooser. Installation permission and extension invocation remain required. Packaged runtime/lifecycle tests pass; the headless shortcut did not fire the action callback, so desktop toolbar capture acceptance is still unverified.
