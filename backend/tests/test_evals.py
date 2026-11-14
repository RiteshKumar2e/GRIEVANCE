"""The evaluation suite's own metrics and its leakage guarantee (evals/run.py)."""
from evals.run import _auc, _calibration, _prf, eval_injection, eval_sla


def test_prf_counts():
    m = _prf(tp=8, fp=2, fn=2, tn=88)
    assert m["precision"] == 0.8 and m["recall"] == 0.8 and m["f1"] == 0.8
    assert m["false_positive_rate"] == round(2 / 90, 4)


def test_ece_is_zero_for_perfectly_calibrated_bins():
    probs = [0.25] * 4 + [0.75] * 4
    labels = [True, False, False, False, True, True, True, False]
    assert _calibration(probs, labels)["ece_10_bins"] == 0.0


def test_ece_detects_overconfidence():
    assert _calibration([0.9] * 10, [False] * 10)["ece_10_bins"] == 0.9


def test_auc_ranks():
    assert _auc([0.9, 0.8, 0.2, 0.1], [True, True, False, False]) == 1.0
    assert _auc([0.5, 0.5], [True, False]) == 0.5


def test_sla_backtest_uses_only_past_outcomes():
    res = eval_sla()
    assert res["leakage_violations"] == 0
    assert res["test_cases"] > 100
    prod = res["variants"]["production (category pool, urgency factor)"]
    assert prod["ece_10_bins"] is not None and prod["auc"] is not None


def test_injection_guard_has_no_false_alarms_on_benign_set():
    assert eval_injection()["false_alarms"] == []
