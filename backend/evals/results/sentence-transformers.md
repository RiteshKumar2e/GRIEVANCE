# Evaluation results: `sentence-transformers` embedder

Generated 2026-11-14T17:29:48+00:00 by `python -m evals.run --embedder sentence-transformers` (Python 3.10.11, seed 20261111). LLM calls disabled. All inputs are author-written or SYNTHETIC; see evals/README.md.

## Intake (rules classifier)

- Category accuracy: 0.865 (45/52)
  - `en`: 0.882 (15/17)
  - `en-mixed`: 1.000 (1/1)
  - `hi`: 0.867 (13/15)
  - `hi-latn`: 0.333 (1/3)
  - `mr`: 0.933 (14/15)
  - `mr-en`: 1.000 (1/1)
- Language detection: 0.885 (46/52)
- Sensitive cases routed to human review: 1.000 (7/7)
- Non-sensitive cases sent to review (workload cost): 0.244 (11/45)
- Misclassified: in-006 WATER_CONTAMINATION→WATER_SUPPLY, in-021 GARBAGE→GENERAL, in-030 MOSQUITO→PROPERTY_TAX, in-032 STRAY_ANIMALS→GENERAL, in-037 ENCROACHMENT→GENERAL, in-046 BRIBERY→GENERAL, in-052 POTHOLE→GENERAL

## Prompt-injection guard

- Precision 1.0, recall 0.6923 (TP 9, FP 0, FN 4, TN 10)
- Missed: inj-010, inj-011, inj-012, inj-013; false alarms: none

## Duplicate detection (`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`)

- 31 reports, 15 incidents, 72 same-department pairs, 27 true duplicate pairs
- At configured threshold 0.78 (min semantic 0.6): precision 1.0, recall 0.7778, F1 0.875, FPR 0.0, FNR 0.2222
- Recall, same-language pairs: 1.000 (4/4); cross-language pairs: 0.739 (17/23)

## Retrieval (`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, k=5)

Relevance proxy: a retrieved precedent is relevant when it has the query's gold category (proxy; no human relevance judgements).

| Mode | P@5 | Hit@1 | MRR | Other-language share |
| --- | --- | --- | --- | --- |
| unfiltered | 0.8615 | 0.8846 | 0.9038 | 0.4115 |
| production | 0.8654 | 0.8654 | 0.8654 | 0.4538 |

Unfiltered, by query language:

| Language | Queries | P@5 | MRR |
| --- | --- | --- | --- |
| en | 17 | 0.9412 | 0.9412 |
| en-mixed | 1 | 0.8 | 0.5 |
| hi | 15 | 0.9467 | 1.0 |
| hi-latn | 3 | 0.3333 | 0.5 |
| mr | 15 | 0.7867 | 0.8667 |
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
