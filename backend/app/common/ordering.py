GAP = 1e-6


def position_for(prev, next_, siblings):
    if not siblings:
        return 1.0
    if prev is None and next_ is None:
        return max(siblings) + 1
    if prev is None:
        return min(siblings) - 1
    if next_ is None:
        return max(siblings) + 1
    return (prev + next_) / 2


def needs_rebalance(prev, next_):
    return prev is not None and next_ is not None and abs(next_ - prev) < GAP


def rebalance(siblings):
    return [float(i) for i in range(1, len(siblings) + 1)]
