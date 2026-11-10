"""Performance limits (mobile). Every block/unit keeps its damage per second, but fires fewer, heavier bullets.

Hundreds of bullets per second (Rapid VI alone fired 120/s, each with a trail, a casing and a muzzle flash) made the game
drop to ~30 FPS even on fast tablets. Limits:
  - a turret fires at most one bullet every TURRET_MIN ticks (20 per second);
  - a shotgun volley fires at most SHOTGUN_PELLETS_PER_S pellets per second;
  - a unit weapon fires at most once every WEAPON_MIN ticks;
  - no bullet trails, no ejected casings (see the generators).
"""
TURRET_MIN = 3
SHOTGUN_PELLETS_PER_S = 24
WEAPON_MIN = 8


def slow(reload, shots=1, min_interval=TURRET_MIN):
    """Reload for ONE bullet per shot, at least min_interval ticks apart, and the factor to multiply the damage of
    that bullet by so the damage per second stays the same."""
    per_bullet = reload / shots
    new = max(per_bullet, min_interval)
    f = new / per_bullet
    return (int(new) if new == int(new) else new), f


def apply_units(units, key_reload="reload", key_dmg="dmg"):
    for u in units:
        new, f = slow(u[key_reload], 1, WEAPON_MIN)
        u[key_reload], u[key_dmg] = new, int(round(u[key_dmg] * f))
