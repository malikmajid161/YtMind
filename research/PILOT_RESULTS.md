# Controlled pilot results

Generated from committed raw results. These are real local executions on **synthetic fixtures**, not live-video quality measurements, competitor trials or publication-ready evidence.

## Retrieval against preserved v1

20 hand-authored English technical excerpts; 32 queries, including 8 additional lexical challenge queries. The baseline is the actual v1 hashed TF/bigram embedder with cosine ranking and precomputed document vectors. BM25 is the rebuilt lexical retriever. No proprietary competitor scores were obtained.

| System | Top-1 count | Top-1 accuracy | 95% Wilson interval | Recall@3 | MRR |
| --- | --- | --- | --- | --- | --- |
| BM25 | 27/32 | 84.4% | 68.2%–93.1% | 84.4% | 0.852 |
| v1 | 26/32 | 81.3% | 64.7%–91.1% | 87.5% | 0.860 |

Paired top-1 disagreements: BM25-only correct 2, v1-only correct 1. Exact two-sided McNemar p-value: **1.0000**. This small, authored sample does not establish a statistically reliable superiority claim. Confidence intervals reflect binomial uncertainty within these selected cases and do not eliminate corpus selection bias.

| Subset | BM25 top-1 | v1 top-1 | BM25 recall@3 | v1 recall@3 |
| --- | --- | --- | --- | --- |
| 24 smoke queries | 100.0% | 95.8% | 100.0% | 100.0% |
| 8 challenge queries | 37.5% | 37.5% | 37.5% | 50.0% |

Both methods struggle on paraphrases with little lexical overlap. BM25 does not dominate every metric. The next experiment should evaluate a hybrid/semantic retriever on a separately annotated held-out video corpus; do not tune this fixture set and present the new score as independent validation. Query timings are single-run pilot timings, not a stable latency benchmark.

## Bundled browser OCR

Browser 154.0.8037.98; Intel(R) Core(TM) Ultra 7 256V, 8 logical CPUs, 16 GiB RAM. Images are controlled English text drawn on a canvas at specified sizes and fonts. Stored raw results include all strings, timings and confidence values.

Exact match: **7/8 (87.5%)**; 95% Wilson interval **52.9%–97.8%**. Mean per-image character error rate: **0.3%**. No external OCR/model asset requests were observed. Two worker slots also recognized separate images concurrently.

| Content | Exact-match count | Accuracy |
| --- | --- | --- |
| prose | 3/3 | 100.0% |
| command | 2/2 | 100.0% |
| code | 2/3 | 66.7% |

Observed failures:
- code-26: expected `const [count, setCount] = useState(0);`; observed `const [count, setCount] = useState(®);`.

The code error is material even though aggregate character error is low. Do not silently repair an OCR symbol and claim exact source extraction. Real video blur, compression, small fonts, themes and motion remain untested here.

## What remains necessary for a paper

Execute the [research protocol](PROTOCOL.md) on rights-appropriate real tutorials with human source annotations, frozen splits, real provider outputs, SAGE/Evidence Lab error analysis, playback/memory profiling, repeated trials and legitimate competitor comparisons. The packaged-extension smoke now passes locally after correcting its worker CSP; live YouTube captions remain unresolved. Software unit/UI tests are separate engineering evidence.

Raw data: [retrieval](results/retrieval-controlled.json), [OCR](results/ocr-controlled.json). The current results support a working pilot and expose failure modes; they do not establish universal uniqueness, hallucination elimination, or market superiority.
