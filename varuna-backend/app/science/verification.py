from __future__ import annotations

import math
from typing import Iterable


def _pairs(forecast: Iterable, reference: Iterable) -> list[tuple[float, float]]:
    out = []
    for f, r in zip(forecast, reference):
        if f is None or r is None:
            continue
        try:
            fv, rv = float(f), float(r)
        except (TypeError, ValueError):
            continue
        if math.isnan(fv) or math.isnan(rv):
            continue
        out.append((fv, rv))
    return out


def rmse(forecast: Iterable, reference: Iterable) -> float | None:
    p = _pairs(forecast, reference)
    if not p:
        return None
    return math.sqrt(sum((f - r) ** 2 for f, r in p) / len(p))


def mae(forecast: Iterable, reference: Iterable) -> float | None:
    p = _pairs(forecast, reference)
    if not p:
        return None
    return sum(abs(f - r) for f, r in p) / len(p)


def bias(forecast: Iterable, reference: Iterable) -> float | None:
    p = _pairs(forecast, reference)
    if not p:
        return None
    return sum(f - r for f, r in p) / len(p)


def pearson_r(forecast: Iterable, reference: Iterable) -> float | None:
    p = _pairs(forecast, reference)
    if len(p) < 2:
        return None
    n = len(p)
    mf = sum(f for f, _ in p) / n
    mr = sum(r for _, r in p) / n
    num = sum((f - mf) * (r - mr) for f, r in p)
    den_f = sum((f - mf) ** 2 for f, _ in p)
    den_r = sum((r - mr) ** 2 for _, r in p)
    den = math.sqrt(den_f * den_r)
    if den == 0:
        return None
    return num / den


def metrics(forecast: Iterable, reference: Iterable) -> dict:
    p = _pairs(forecast, reference)
    return {
        "n": len(p),
        "rmse": rmse(forecast, reference),
        "mae": mae(forecast, reference),
        "bias": bias(forecast, reference),
        "pearson_r": pearson_r(forecast, reference),
    }


def round_metrics(m: dict, ndigits: int = 3) -> dict:
    return {
        k: (round(v, ndigits) if isinstance(v, float) else v)
        for k, v in m.items()
    }
