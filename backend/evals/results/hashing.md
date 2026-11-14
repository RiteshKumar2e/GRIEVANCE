# Evaluation results: `hashing` embedder

Generated 2026-11-14T17:28:25+00:00 by `python -m evals.run --embedder hashing` (Python 3.10.11, seed 20261111). LLM calls disabled. All inputs are author-written or SYNTHETIC; see evals/README.md.

## Intake (rules classifier)

- Category accuracy: 0.885 (46/52)
  - `en`: 0.882 (15/17)
  - `en-mixed`: 1.000 (1/1)
  - `hi`: 0.867 (13/15)
  - `hi-latn`: 0.333 (1/3)
  - `mr`: 1.000 (15/15)
  - `mr-en`: 1.000 (1/1)
- Language detection: 0.885 (46/52)
- Sensitive cases routed to human review: 1.000 (7/7)
- Non-sensitive cases sent to review (workload cost): 0.244 (11/45)
- Misclassified: in-006 WATER_CONTAMINATION→WATER_SUPPLY, in-021 GARBAGE→GENERAL, in-032 STRAY_ANIMALS→GENERAL, in-037 ENCROACHMENT→GENERAL, in-046 BRIBERY→GENERAL, in-052 POTHOLE→GENERAL

## Prompt-injection guard

- Precision 1.0, recall 0.6923 (TP 9, FP 0, FN 4, TN 10)
- Missed: inj-010, inj-011, inj-012, inj-013; false alarms: none

## Duplicate detection (`hashing-ngram-384`)

- 31 reports, 15 incidents, 72 same-department pairs, 27 true duplicate pairs
- At configured threshold 0.62 (min semantic 0.25): precision 0.8, recall 0.1481, F1 0.25, FPR 0.0222, FNR 0.8519
- Recall, same-language pairs: 1.000 (4/4); cross-language pairs: 0.000 (0/23)

## Retrieval (`hashing-ngram-384`, k=5)

Relevance proxy: a retrieved precedent is relevant when it has the query's gold category (proxy; no human relevance judgements).

| Mode | P@5 | Hit@1 | MRR | Other-language share |
| --- | --- | --- | --- | --- |
| unfiltered | 0.7654 | 0.8269 | 0.8526 | 0.0731 |
| production | 0.8538 | 0.9038 | 0.9199 | 0.0808 |

Unfiltered, by query language:

| Language | Queries | P@5 | MRR |
| --- | --- | --- | --- |
| en | 17 | 0.8235 | 0.9412 |
| en-mixed | 1 | 0.0 | 0.0 |
| hi | 15 | 0.7467 | 0.8222 |
| hi-latn | 3 | 0.6 | 0.8333 |
| mr | 15 | 0.7867 | 0.8333 |
| mr-en | 1 | 1.0 | 1.0 |

## SLA breach prediction (chronological backtest)

- 216 test cases from 2026-08-23; breach rate 0.287 (62/216); 1 right-censored rows excluded; leakage violations: 0

| Predictor | ECE | Brier | AUC | Log loss |
| --- | --- | --- | --- | --- |
| production (category pool, urgency factor) | 0.0268 | 0.1903 | 0.6487 | 0.5617 |
| without urgency factor | 0.0339 | 0.1918 | 0.6378 | 0.565 |
| baseline: historical base rate | 0.0424 | 0.2064 | 0.5357 | 0.604 |
| baseline: constant 0.3 (cold-start default) | 0.013 | 0.2048 | 0.5 | 0.5999 |

> The synthetic generator draws resolution times from a per-category log-normal distribution that does not depend on time, urgency or load. Good numbers here show the estimator recovers that distribution; they are not evidence of real-world accuracy.
