from __future__ import annotations

import math

from ..config import WEIGHT_EPSILON


def hamilton_hare(raw: dict[str, float]) -> dict[str, int]:
    if not raw:
        return {}
    keys = list(raw.keys())
    values = [max(float(raw[k]), 0.0) for k in keys]
    total = sum(values)

    if total <= 0:
        values = [1.0] * len(keys)
        total = float(len(keys))

    quotas = [v / total * 100.0 for v in values]
    floors = [math.floor(q) for q in quotas]
    remainders = [q - f for q, f in zip(quotas, floors)]
    leftover = 100 - sum(floors)

    order = sorted(
        range(len(keys)),
        key=lambda i: (-remainders[i], -values[i], keys[i]),
    )
    i = 0
    while leftover > 0 and order:
        floors[order[i % len(order)]] += 1
        leftover -= 1
        i += 1

    out = {keys[idx]: int(floors[idx]) for idx in range(len(keys))}
    assert sum(out.values()) == 100, "Hamilton-Hare must sum to exactly 100"
    assert all(v >= 0 for v in out.values()), "weights must be non-negative"
    return out


def weights_from_predicted_errors(predicted_errors: dict[str, float | None]) -> dict[str, int]:
    available = {k: v for k, v in predicted_errors.items() if v is not None}
    if not available:
        return {}
    raw = {
        k: 1.0 / (max(float(v), WEIGHT_EPSILON) ** 2)
        for k, v in available.items()
    }
    return hamilton_hare(raw)


def static_inverse_rmse_weights(rmses: dict[str, float]) -> dict[str, int]:
    return weights_from_predicted_errors(rmses)


def blend_value(member_values: dict[str, float | None], weights: dict[str, int]) -> float | None:
    used = {
        k: float(v)
        for k, v in member_values.items()
        if v is not None and k in weights and weights[k] > 0
    }
    if not used:
        return None
    total_w = sum(weights[k] for k in used)
    if total_w <= 0:
        return None
    return sum(weights[k] / total_w * v for k, v in used.items())


def ensemble_stats(member_values: dict[str, float | None]) -> tuple[float | None, float | None]:
    vals = [float(v) for v in member_values.values() if v is not None]
    if not vals:
        return None, None
    mean = sum(vals) / len(vals)
    if len(vals) == 1:
        return mean, 0.0
    var = sum((v - mean) ** 2 for v in vals) / len(vals)
    return mean, math.sqrt(var)
