"""Decimal utilities — centralised rounding and conversion.

All financial arithmetic uses Python Decimal throughout.
No float conversions at any stage.
Rounding mode: ROUND_HALF_UP at final output step only.

Minor units per currency (all 2dp):
  USD — cents
  EUR — cents
  KES — cents
  NGN — kobo
"""
from __future__ import annotations
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

# 2 decimal places for all supported currencies
QUANTUM = Decimal("0.01")


def quantize(value: Decimal) -> Decimal:
    """
    Round to 2dp using ROUND_HALF_UP.
    Called only at the final output step — never mid-calculation.
    """
    return value.quantize(QUANTUM, rounding=ROUND_HALF_UP)


def to_decimal(value: str | int | float) -> Decimal:
    """
    Safely convert any value to Decimal.
    Always goes through str() first to avoid float precision loss.

    e.g. to_decimal(100.5) → Decimal("100.5")
         not Decimal("100.4999999...")
    """
    try:
        return Decimal(str(value))
    except InvalidOperation:
        raise ValueError(f"cannot convert {value!r} to Decimal")