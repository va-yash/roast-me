"""
prompt_builder.py — Yoga Detection + Vimshottari Dasha + Roast Prompt Assembly

Depends on: vedic_calc.py
Install:    pip install pyswisseph python-dateutil

Entry point:
    from prompt_builder import build_roast_system_prompt
    blocks = build_roast_system_prompt(chart, birth_dt, birth_data=..., ...)

── 2026-08 · WHY THIS FILE CHANGED ──────────────────────────────────────────
Two separate problems, both showing up as "the roast is generic".

1. THE YOGA LIST WAS ~40% WRONG. Measured on a real chart (Taurus lagna,
   24 Oct 1999): ten yogas reported, four of them false or duplicated. The
   model was being told a difficult chart was full of Raja Yogas, so it wrote
   a flattering roast. Details on each fix are at the detector that carries it.

2. THE MODEL KNEW NOTHING ABOUT THE PERSON. Not their age, not their name, not
   today's date, and nothing about where the planets are RIGHT NOW. A birth
   chart with no age attached can only produce observations that would fit
   anyone born under that sign — which is the definition of a generic roast.
   The name and gender were being collected by the form and thrown away.

The prompt is now two blocks: an invariant craft block that can be cached
across every user of the app, and a per-person evidence block that comes last.
"""

from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from vedic_calc import (SIGNS, SIGN_ABBR, calculate_transits, saturn_pressure,
                        jaimini_karakas)

# ─── Vimshottari Dasha ────────────────────────────────────────────────────────

DASHA_ORDER = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]

DASHA_YEARS = {
    "Ketu": 7, "Venus": 20, "Sun": 6, "Moon": 10, "Mars": 7,
    "Rahu": 18, "Jupiter": 16, "Saturn": 19, "Mercury": 17
}

# Nakshatra index (0-26) → Dasha lord
NAK_DASHA_LORD = [
    "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu",
    "Jupiter", "Saturn", "Mercury",
    "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu",
    "Jupiter", "Saturn", "Mercury",
    "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu",
    "Jupiter", "Saturn", "Mercury"
]

NAK_SIZE = 360.0 / 27          # 13.3333°
TOTAL_YEARS = 120.0


def _add_years_fractional(dt: datetime, years_float: float) -> datetime:
    """Add fractional years to a datetime using day-based precision."""
    return dt + timedelta(days=years_float * 365.25)


def calculate_vimshottari(moon_lon: float, birth_dt: datetime) -> list[dict]:
    """
    Compute the full Vimshottari Dasha sequence (9 periods + their sub-periods)
    anchored on the Moon's sidereal longitude and birth datetime.

    Returns list of dicts:
        lord, start, end, years, antardashas: [{lord, start, end}]
    """
    nak_idx      = int(moon_lon / NAK_SIZE) % 27
    birth_lord   = NAK_DASHA_LORD[nak_idx]
    pos_in_nak   = moon_lon % NAK_SIZE
    elapsed_frac = pos_in_nak / NAK_SIZE          # how far into nakshatra

    md_years_total  = DASHA_YEARS[birth_lord]
    elapsed_in_md   = elapsed_frac * md_years_total
    md_start        = _add_years_fractional(birth_dt, -elapsed_in_md)

    start_idx = DASHA_ORDER.index(birth_lord)
    sequence  = []
    cur_start = md_start

    for i in range(9):
        md_lord  = DASHA_ORDER[(start_idx + i) % 9]
        md_years = DASHA_YEARS[md_lord]
        md_end   = _add_years_fractional(cur_start, md_years)

        # Antardashas: sequence starts from the MD lord itself
        ad_start   = cur_start
        antardashas = []
        ad_offset   = i  # AD sequence starts at same position as MD lord
        for j in range(9):
            ad_lord  = DASHA_ORDER[(start_idx + ad_offset + j) % 9]
            ad_years = (md_years * DASHA_YEARS[ad_lord]) / TOTAL_YEARS
            ad_end   = _add_years_fractional(ad_start, ad_years)
            antardashas.append({"lord": ad_lord, "start": ad_start, "end": ad_end})
            ad_start = ad_end

        sequence.append({
            "lord":        md_lord,
            "start":       cur_start,
            "end":         md_end,
            "years":       md_years,
            "antardashas": antardashas
        })
        cur_start = md_end

    return sequence


def get_current_dasha(sequence: list[dict], query_date: datetime) -> dict:
    """
    Given the dasha sequence and a query date, return:
        mahadasha lord + dates, antardasha lord + dates, next MD + AD transitions.
    """
    result = {
        "mahadasha":  None, "md_start": None, "md_end": None,
        "antardasha": None, "ad_start": None, "ad_end": None,
        "upcoming":   []
    }

    for period in sequence:
        if period["start"] <= query_date < period["end"]:
            result["mahadasha"] = period["lord"]
            result["md_start"]  = period["start"]
            result["md_end"]    = period["end"]

            for ad in period["antardashas"]:
                if ad["start"] <= query_date < ad["end"]:
                    result["antardasha"] = ad["lord"]
                    result["ad_start"]   = ad["start"]
                    result["ad_end"]     = ad["end"]
                    break
            break

    # Next two MD transitions
    for p in sequence:
        if p["start"] > query_date:
            result["upcoming"].append({"lord": p["lord"], "start": p["start"]})
            if len(result["upcoming"]) >= 2:
                break

    return result


def format_dasha_block(sequence: list[dict], query_date: datetime) -> str:
    """Return a formatted multi-line dasha block for the system prompt."""
    cur   = get_current_dasha(sequence, query_date)
    lines = ["CURRENT DASHA TIMELINE"]

    if cur["mahadasha"]:
        lines.append(
            f"Mahadasha  : {cur['mahadasha']:<10} "
            f"({cur['md_start'].strftime('%b %d, %Y')} → {cur['md_end'].strftime('%b %d, %Y')})"
        )
    if cur["antardasha"]:
        lines.append(
            f"Antardasha : {cur['antardasha']:<10} "
            f"({cur['ad_start'].strftime('%b %d, %Y')} → {cur['ad_end'].strftime('%b %d, %Y')})"
        )

    lines.append("")
    lines.append("UPCOMING MAHADASHA TRANSITIONS")
    for u in cur["upcoming"]:
        lines.append(f"  → {u['lord']:<10} begins {u['start'].strftime('%b %d, %Y')}")

    lines.append("")
    lines.append("FULL MAHADASHA SEQUENCE (birth onward)")
    for p in sequence:
        marker = " ◀ ACTIVE" if p["lord"] == cur.get("mahadasha") else ""
        lines.append(
            f"  {p['lord']:<10} {p['start'].strftime('%Y')}–{p['end'].strftime('%Y')}{marker}"
        )

    return "\n".join(lines)


def format_dasha_block_roast(sequence: list[dict], query_date: datetime,
                             birth_dt: datetime = None) -> str:
    """
    Lean dasha block for the roast prompt — current period, how long it has been
    running, and what comes next.

    2026-08: added "started N years ago" and the age the next period lands at.
    A period boundary is only funny if you know where the person is standing in
    it. "Six years into a stretch that rewards visibility, still not visible"
    needs the six.
    """
    cur   = get_current_dasha(sequence, query_date)
    lines = ["CURRENT LIFE PERIOD (Vimshottari)"]

    if cur["mahadasha"]:
        yrs_in   = (query_date - cur["md_start"]).days / 365.25
        yrs_left = (cur["md_end"] - query_date).days / 365.25
        lines.append(
            f"Mahadasha: {cur['mahadasha']} "
            f"({cur['md_start'].strftime('%b %Y')} – {cur['md_end'].strftime('%b %Y')}) "
            f"— {yrs_in:.1f} yrs in, {yrs_left:.1f} yrs left"
        )
    if cur["antardasha"]:
        lines.append(
            f"Antardasha: {cur['antardasha']} "
            f"({cur['ad_start'].strftime('%b %Y')} – {cur['ad_end'].strftime('%b %Y')})"
        )

    if cur["upcoming"]:
        parts = []
        for u in cur["upcoming"]:
            at_age = ""
            if birth_dt:
                at_age = f" (at age {int((u['start'] - birth_dt).days / 365.25)})"
            parts.append(f"{u['lord']} from {u['start'].strftime('%Y')}{at_age}")
        lines.append("Next: " + ", ".join(parts))

    return "\n".join(lines)


# ─── House-lord map ───────────────────────────────────────────────────────────

# Traditional (Parashari) sign lords — used for yoga detection
SIGN_LORDS = [
    "Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury",
    "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter"
]


def house_lords(asc_sign_idx: int) -> dict[int, str]:
    """Return {house_number: lord_planet} for any ascendant sign index."""
    return {
        h: SIGN_LORDS[(asc_sign_idx + h - 1) % 12]
        for h in range(1, 13)
    }


def planet_house(d1: dict, name: str) -> int:
    return d1[name]["house"]


def planet_sign(d1: dict, name: str) -> int:
    return d1[name]["sign_idx"]


def houses_of_planet(d1: dict, planet_name: str, asc_idx: int) -> int:
    """Which house is this planet in?"""
    return (d1[planet_name]["sign_idx"] - asc_idx) % 12 + 1


# ─── Yoga detection ───────────────────────────────────────────────────────────

PLANETS_ALL = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"]
CLASSICAL   = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"]
BENEFICS    = {"Jupiter", "Venus", "Moon", "Mercury"}
MALEFICS    = {"Sun", "Mars", "Saturn", "Rahu", "Ketu"}
KENDRA      = {1, 4, 7, 10}
TRIKONA     = {1, 5, 9}
TRIK        = {6, 8, 12}

DEBIL_SIGN = {"Sun": 6, "Moon": 7, "Mars": 3, "Mercury": 11,
              "Jupiter": 9, "Venus": 5, "Saturn": 0, "Rahu": 7, "Ketu": 1}
EXALT_SIGN = {"Sun": 0, "Moon": 1, "Mars": 9, "Mercury": 5,
              "Jupiter": 3, "Venus": 11, "Saturn": 6}
OWN_SIGNS  = {"Mars": [0, 7], "Venus": [1, 6], "Mercury": [2, 5],
              "Moon": [3], "Sun": [4], "Jupiter": [8, 11], "Saturn": [9, 10]}

# The five Mahapurusha yogas — a planet in its own or exalted sign, in a kendra.
MAHAPURUSHA = {
    "Mars":    ("Ruchaka", "commanding, physical, picks fights they can win"),
    "Mercury": ("Bhadra",  "quick, verbal, wins arguments and loses friends"),
    "Jupiter": ("Hamsa",   "advisory, moralising, everyone's unpaid therapist"),
    "Venus":   ("Malavya", "aesthetic, comfort-seeking, will not live ugly"),
    "Saturn":  ("Sasa",    "disciplined, controlling, outlasts everyone"),
}

# Same-sign pairings that carry a name and a very specific reputation.
CONJUNCTION_NAMES = {
    frozenset(["Jupiter", "Rahu"]):  ("Guru Chandala",
        "belief tangled with appetite — preaches one thing, wants another"),
    frozenset(["Mars", "Rahu"]):     ("Angarak",
        "an accelerator with no brake; anger arrives before the thought"),
    frozenset(["Saturn", "Rahu"]):   ("Shrapit",
        "delay stacked on obsession; the thing wanted most arrives latest"),
    frozenset(["Moon", "Saturn"]):   ("Punarphoo",
        "emotional cold storage — feels it fully, shows it never"),
    frozenset(["Sun", "Mercury"]):   ("Budhaditya",
        "clever and knows it; identity fused to being the smart one"),
    frozenset(["Moon", "Mars"]):     ("Chandra-Mangala",
        "emotion converted straight into money or into a fight"),
    frozenset(["Moon", "Rahu"]):     ("Grahan (lunar)",
        "moods amplified past their real size; craving mistaken for feeling"),
    frozenset(["Moon", "Ketu"]):     ("Grahan (lunar)",
        "emotionally checked out in a way they call being fine"),
    frozenset(["Sun", "Rahu"]):      ("Grahan (solar)",
        "identity inflated and unstable; needs the room to agree"),
    frozenset(["Sun", "Ketu"]):      ("Grahan (solar)",
        "no interest in the thing they are objectively good at"),
    frozenset(["Jupiter", "Saturn"]): ("Guru-Shani",
        "faith and duty pulling opposite ways; permanently negotiating"),
    frozenset(["Venus", "Saturn"]):  ("Venus-Saturn",
        "wants closeness, builds the barrier, blames the barrier"),
    frozenset(["Venus", "Ketu"]):    ("Venus-Ketu",
        "gets the relationship, loses interest the week it is secure"),
    frozenset(["Mars", "Saturn"]):   ("Mars-Saturn",
        "drive against brake — bursts of effort separated by long stalls"),
}


def detect_yogas(chart: dict) -> list[dict]:
    """
    Detect major classical yogas from the chart dict.
    Returns list of {name, description, planets, quality}
    where quality is 'benefic' | 'challenging' | 'mixed'.
    """
    d1      = chart["d1"]
    # Back-calculate the lagna from any planet: sign - house + 1, mod 12.
    asc_idx = (d1["Moon"]["sign_idx"] - d1["Moon"]["house"] + 1) % 12
    lords   = house_lords(asc_idx)
    yogas   = []

    def h(name):
        return d1[name]["house"]

    def s(name):
        return d1[name]["sign_idx"]

    def same_house(p1, p2):
        return h(p1) == h(p2)

    def is_debil(name):
        return d1[name].get("debilitated", False)

    def is_retro(name):
        return d1[name].get("retrograde", False)

    def is_exalted(name):
        return d1[name].get("exalted", False)

    def owns(planet):
        """Which houses does this planet rule, for this lagna?"""
        return sorted(k for k, v in lords.items() if v == planet)

    # ── 1. Gaja Kesari Yoga ──────────────────────────────────────────────
    moon_h = h("Moon")
    jup_h  = h("Jupiter")
    diff   = abs(moon_h - jup_h)
    mutual_kendra = diff in (0, 3, 6, 9)  # houses 1,4,7,10 from each other
    if mutual_kendra and jup_h in KENDRA:
        yogas.append({
            "name": "Gaja Kesari Yoga",
            "description": "Jupiter in a kendra from Moon — grants wisdom, renown, and moral authority.",
            "planets": ["Moon", "Jupiter"],
            "quality": "benefic"
        })

    # ── 2. Neecha Bhanga Raja Yoga ───────────────────────────────────────
    EXALT_LORD = {v: k for k, v in EXALT_SIGN.items()}  # sign_idx → exalting planet

    for planet in CLASSICAL:
        if not is_debil(planet):
            continue

        debil_sign_idx = DEBIL_SIGN[planet]
        disp = SIGN_LORDS[debil_sign_idx]   # lord of debilitation sign
        disp_house = h(disp)

        exalt_planet = EXALT_LORD.get(debil_sign_idx)

        cancellation = False
        reason = ""

        # Rule 1: Lord of debilitation sign in kendra from lagna
        if disp_house in KENDRA:
            cancellation = True
            reason = f"{disp} (lord of debilitation sign) is in kendra (H{disp_house})"

        # Rule 2: Exaltation lord of the sign in kendra
        if exalt_planet and h(exalt_planet) in KENDRA:
            cancellation = True
            reason += ("; " if reason else "") + \
                      f"{exalt_planet} (exaltation lord of {SIGNS[debil_sign_idx]}) in kendra (H{h(exalt_planet)})"

        # Rule 3: Dispositor of debilitated planet in kendra from Moon
        moon_sign = s("Moon")
        disp_from_moon = (s(disp) - moon_sign) % 12 + 1
        if disp_from_moon in KENDRA:
            cancellation = True
            reason += ("; " if reason else "") + \
                      f"{disp} in kendra from Moon"

        if cancellation:
            yogas.append({
                "name": f"Neecha Bhanga Raja Yoga — {planet}",
                "description": (
                    f"{planet} is debilitated in {SIGNS[debil_sign_idx]} but its fall is cancelled: {reason}. "
                    "This converts weakness into latent royal power, activated through adversity."
                ),
                "planets": [planet, disp],
                "quality": "mixed"
            })
        else:
            # 2026-08: an UNCANCELLED debilitation was reported nowhere at all,
            # and it is far better roast material than a cancelled one. A
            # debilitated planet is a permanent felt deficiency in exactly the
            # department that planet governs.
            yogas.append({
                "name": f"Debilitated {planet} (no cancellation)",
                "description": (
                    f"{planet} sits fallen in {SIGNS[debil_sign_idx]} (H{h(planet)}) "
                    f"with nothing rescuing it"
                    + (" — and retrograde, so it is worked at inwardly and never resolved."
                       if is_retro(planet) else ".")
                ),
                "planets": [planet],
                "quality": "challenging"
            })

    # ── 3. Viparita Raja Yoga ────────────────────────────────────────────
    # 2026-08 · DEDUPLICATED. When the 6th/8th/12th lords swap houses with each
    # other, the old code emitted this twice (once per direction) AND the
    # Parivartana detector below emitted it a third time. One fact, three
    # lines, and a "benefic" list padded to look impressive. The exchange case
    # is now claimed here, once, and Parivartana skips it.
    _vry_pairs_seen = set()
    _vry_exchange_pairs = set()
    for trik_house in (6, 8, 12):
        lord_of_trik = lords[trik_house]
        lord_house   = h(lord_of_trik)
        if lord_house in TRIK and lord_house != trik_house:
            other_lord = lords[lord_house]
            # Is it a true mutual exchange?
            if h(other_lord) == trik_house and other_lord != lord_of_trik:
                key = frozenset([lord_of_trik, other_lord])
                if key in _vry_pairs_seen:
                    continue
                _vry_pairs_seen.add(key)
                _vry_exchange_pairs.add(key)
                yogas.append({
                    "name": f"Viparita Raja Yoga — H{trik_house}/H{lord_house} exchange",
                    "description": (
                        f"The lords of H{trik_house} and H{lord_house} ({lord_of_trik} and "
                        f"{other_lord}) have swapped houses — the two hardest areas of the "
                        "chart feed each other, and setbacks in one become leverage in the other."
                    ),
                    "planets": [lord_of_trik, other_lord],
                    "quality": "mixed"
                })
            else:
                yogas.append({
                    "name": f"Viparita Raja Yoga ({trik_house}th lord in {lord_house}th)",
                    "description": (
                        f"Lord of H{trik_house} ({lord_of_trik}) placed in H{lord_house} "
                        "— adversity and obstacles become the source of unexpected power."
                    ),
                    "planets": [lord_of_trik],
                    "quality": "mixed"
                })

    # ── 4. Kemadruma Yoga ────────────────────────────────────────────────
    # 2026-08 · THE MOON WAS BEING CALLED ISOLATED WHILE SITTING IN A CROWD.
    # The old check looked only at the 2nd and 12th SIGNS from the Moon. On the
    # reference chart the Moon is conjunct BOTH Jupiter and Saturn and it still
    # fired. No classical authority calls that Kemadruma — the yoga is about a
    # Moon with no planetary company, and a planet in the same sign is the most
    # company it can have.
    #
    # The standard cancellations (Kemadruma Bhanga) are checked too: a Moon in a
    # kendra from the lagna, or aspected/joined by a benefic, is not isolated.
    moon_sign = s("Moon")
    second_from_moon  = (moon_sign + 1) % 12
    twelfth_from_moon = (moon_sign - 1) % 12

    conjunct_moon = [p for p in CLASSICAL if p != "Moon" and s(p) == moon_sign]
    flanking_planets = [
        p for p in CLASSICAL
        if p != "Moon" and s(p) in (second_from_moon, twelfth_from_moon)
    ]
    bhanga = []
    if conjunct_moon:
        bhanga.append(f"Moon is conjunct {', '.join(conjunct_moon)}")
    if h("Moon") in KENDRA:
        bhanga.append(f"Moon sits in a kendra (H{h('Moon')})")
    benefic_with_moon = [p for p in conjunct_moon if p in BENEFICS]
    if benefic_with_moon:
        bhanga.append(f"benefic {', '.join(benefic_with_moon)} with the Moon")

    if not flanking_planets and not bhanga:
        yogas.append({
            "name": "Kemadruma Yoga",
            "description": (
                "The Moon stands completely alone — no planet with it and none on "
                "either side. Emotional self-sufficiency by force rather than choice: "
                "nobody is coming, so they learned not to ask."
            ),
            "planets": ["Moon"],
            "quality": "challenging"
        })
    elif not flanking_planets and bhanga:
        yogas.append({
            "name": "Kemadruma Bhanga (isolation cancelled)",
            "description": (
                "Nothing flanks the Moon, but the isolation is cancelled — "
                + "; ".join(bhanga) +
                ". The feeling of being alone is real; the fact of it is not."
            ),
            "planets": ["Moon"] + conjunct_moon,
            "quality": "mixed"
        })

    # ── 5. Sunapha / Anapha / Durudhara (planets around the Moon) ────────
    # Replaces the old Veshi-only check. These three are the standard Moon
    # trio and they say more about temperament than Veshi does.
    second_tenants  = [p for p in CLASSICAL if p != "Moon" and s(p) == second_from_moon]
    twelfth_tenants = [p for p in CLASSICAL if p != "Moon" and s(p) == twelfth_from_moon]
    if second_tenants and twelfth_tenants:
        yogas.append({
            "name": "Durudhara Yoga",
            "description": ("Planets on both sides of the Moon — support arrives from "
                            "both directions and is rarely noticed as support."),
            "planets": ["Moon"] + second_tenants + twelfth_tenants,
            "quality": "benefic"})
    elif second_tenants:
        yogas.append({
            "name": "Sunapha Yoga",
            "description": ("Planets in the 2nd from Moon — self-made resources, "
                            "earned rather than given."),
            "planets": ["Moon"] + second_tenants, "quality": "benefic"})
    elif twelfth_tenants:
        yogas.append({
            "name": "Anapha Yoga",
            "description": ("Planets in the 12th from Moon — spends on image and "
                            "comfort, well before the money exists."),
            "planets": ["Moon"] + twelfth_tenants, "quality": "benefic"})

    # ── 6. Dharma-Karmadhipati Yoga ──────────────────────────────────────
    # 2026-08 · THIS FIRED ON EVERY TAURUS, CANCER, LIBRA AND AQUARIUS LAGNA.
    # For those ascendants ONE planet rules both the 9th and the 10th, and the
    # old code asked `same_house(lord_9, lord_10)` — i.e. is Saturn in the same
    # house as Saturn. Always true. A single planet ruling a kendra and a
    # trikona is a real and important thing, but it is called a YOGAKARAKA, and
    # that is what gets reported now.
    lord_9  = lords[9]
    lord_10 = lords[10]
    if lord_9 == lord_10:
        yogas.append({
            "name": f"Yogakaraka — {lord_9}",
            "description": (
                f"{lord_9} rules both H9 and H10 for this lagna, so one planet carries "
                f"both purpose and profession. It sits in H{h(lord_9)}"
                + (" debilitated" if is_debil(lord_9) else "")
                + (" and retrograde" if is_retro(lord_9) else "")
                + ". Whatever condition it is in, that is the condition of the career."
            ),
            "planets": [lord_9],
            "quality": "benefic" if not is_debil(lord_9) else "mixed"
        })
    elif same_house(lord_9, lord_10):
        yogas.append({
            "name": "Dharma-Karmadhipati Yoga",
            "description": (
                f"9th lord ({lord_9}) and 10th lord ({lord_10}) conjunct in H{h(lord_9)} — "
                "purpose and career are the same project."
            ),
            "planets": [lord_9, lord_10],
            "quality": "benefic"
        })
    elif s(lord_9) == (asc_idx + 9) % 12 and s(lord_10) == (asc_idx + 8) % 12:
        yogas.append({
            "name": "Dharma-Karmadhipati Yoga (Exchange)",
            "description": (
                f"9th lord ({lord_9}) and 10th lord ({lord_10}) exchange signs — "
                "powerful alignment of purpose and profession."
            ),
            "planets": [lord_9, lord_10],
            "quality": "benefic"
        })

    # ── 7. Raja Yoga (kendra lord + trikona lord conjunct) ───────────────
    # 2026-08 · THE BUG THAT INVENTED RAJA YOGAS.
    # The old test was:
    #     (p1 in kendra_lords or p2 in kendra_lords)
    #     and (p1 in trikona_lords or p2 in trikona_lords)
    # Both halves can be satisfied by the SAME planet. For a Taurus lagna
    # Saturn rules the 9th and the 10th, so Saturn alone passed both tests and
    # every planet that happened to share a house with it was reported as
    # "Raja Yoga — X + Saturn". On the reference chart that produced two
    # fictitious Raja Yogas out of ten findings.
    #
    # A Raja Yoga needs TWO DIFFERENT planets, one supplying the kendra
    # rulership and the other the trikona rulership. The single-planet case is
    # the Yogakaraka above.
    kendra_lords  = {lords[x] for x in KENDRA  if x != 1}   # 4, 7, 10
    trikona_lords = {lords[x] for x in TRIKONA if x != 1}   # 5, 9
    seen_raja = set()
    for p1 in CLASSICAL:
        for p2 in CLASSICAL:
            if p1 >= p2 or not same_house(p1, p2):
                continue
            pair_ok = ((p1 in kendra_lords and p2 in trikona_lords) or
                       (p2 in kendra_lords and p1 in trikona_lords))
            if not pair_ok:
                continue
            key = frozenset([p1, p2])
            if key in seen_raja:
                continue
            seen_raja.add(key)
            yogas.append({
                "name": f"Raja Yoga — {p1} + {p2}",
                "description": (
                    f"{p1} (rules H{owns(p1)}) and {p2} (rules H{owns(p2)}) conjunct in "
                    f"H{h(p1)} — a kendra lord and a trikona lord meeting."
                ),
                "planets": [p1, p2],
                "quality": "benefic"
            })

    # ── 8. Parivartana (sign exchange) ───────────────────────────────────
    for i, p1 in enumerate(CLASSICAL):
        for p2 in CLASSICAL[i + 1:]:
            p1_sign, p2_sign = s(p1), s(p2)
            if p1_sign in OWN_SIGNS.get(p2, []) and p2_sign in OWN_SIGNS.get(p1, []):
                if frozenset([p1, p2]) in _vry_exchange_pairs:
                    continue      # already reported as a Viparita exchange
                h1, h2 = h(p1), h(p2)
                is_maha = (h1 in KENDRA | TRIKONA) and (h2 in KENDRA | TRIKONA)
                yoga_name = "Maha Parivartana Yoga" if is_maha else "Parivartana Yoga"
                yogas.append({
                    "name": f"{yoga_name} — {p1} ↔ {p2} (H{h1} ↔ H{h2})",
                    "description": (
                        f"{p1} in {SIGNS[p1_sign]} (H{h1}) exchanges signs with "
                        f"{p2} in {SIGNS[p2_sign]} (H{h2}) — the two houses merge; "
                        "neither area of life can be fixed without the other."
                    ),
                    "planets": [p1, p2],
                    "quality": "benefic"
                })

    # ── 9. Pancha Mahapurusha Yogas ──────────────────────────────────────
    # The five most famous yogas in Jyotish and the detector could not see any
    # of them. A planet in its own or exaltation sign, sitting in a kendra.
    for planet, (yname, flavour) in MAHAPURUSHA.items():
        if h(planet) in KENDRA and (s(planet) in OWN_SIGNS[planet]
                                    or s(planet) == EXALT_SIGN[planet]):
            yogas.append({
                "name": f"{yname} Yoga (Pancha Mahapurusha) — {planet}",
                "description": (
                    f"{planet} strong in {SIGNS[s(planet)]} in kendra H{h(planet)}: "
                    f"{flavour}. This is a defining trait, not a subtle one."
                ),
                "planets": [planet],
                "quality": "benefic"
            })

    # ── 10. Kaal Sarpa ───────────────────────────────────────────────────
    # Enormously well known in India and completely absent from the detector.
    rahu_sign, ketu_sign = s("Rahu"), s("Ketu")
    span = ((ketu_sign - rahu_sign) % 12) + 1
    arc  = {(rahu_sign + k) % 12 for k in range(span)}
    inside  = [p for p in CLASSICAL if s(p) in arc]
    outside = [p for p in CLASSICAL if s(p) not in arc]
    if not outside or not inside:
        yogas.append({
            "name": "Kaal Sarpa Yoga",
            "description": (
                "Every planet is trapped on one side of the Rahu–Ketu axis. Life runs "
                "in long blocked stretches followed by sudden releases, and almost "
                "nothing arrives on the schedule they planned."
            ),
            "planets": ["Rahu", "Ketu"],
            "quality": "challenging"
        })

    # ── 11. Shakata Yoga ─────────────────────────────────────────────────
    moon_from_jup = (s("Moon") - s("Jupiter")) % 12 + 1
    if moon_from_jup in (6, 8, 12):
        yogas.append({
            "name": "Shakata Yoga",
            "description": (
                f"Moon sits {moon_from_jup}th from Jupiter — fortune arrives and leaves "
                "in cycles. Every rise is followed by a dip they did not budget for."
            ),
            "planets": ["Moon", "Jupiter"],
            "quality": "challenging"
        })

    # ── 12. Named conjunctions ───────────────────────────────────────────
    for i, p1 in enumerate(PLANETS_ALL):
        for p2 in PLANETS_ALL[i + 1:]:
            if {p1, p2} == {"Rahu", "Ketu"}:
                continue
            if s(p1) != s(p2):
                continue
            named = CONJUNCTION_NAMES.get(frozenset([p1, p2]))
            if not named:
                continue
            label, flavour = named
            yogas.append({
                "name": f"{label} — {p1} + {p2} (H{h(p1)})",
                "description": f"{p1} and {p2} share {SIGNS[s(p1)]} in H{h(p1)}: {flavour}.",
                "planets": [p1, p2],
                "quality": "challenging" if label not in
                           ("Budhaditya", "Chandra-Mangala") else "mixed"
            })

    # Deduplicate by name
    seen_names = set()
    unique_yogas = []
    for y in yogas:
        if y["name"] not in seen_names:
            seen_names.add(y["name"])
            unique_yogas.append(y)

    return unique_yogas


def format_yoga_block(yogas: list[dict]) -> str:
    """Format yoga list into a structured text block for the prompt."""
    if not yogas:
        return "ACTIVE YOGAS\nNone detected."

    benefic     = [y for y in yogas if y["quality"] == "benefic"]
    mixed       = [y for y in yogas if y["quality"] == "mixed"]
    challenging = [y for y in yogas if y["quality"] == "challenging"]

    lines = ["ACTIVE YOGAS & SPECIAL COMBINATIONS", ""]

    if benefic:
        lines.append("Gifts & Blessings:")
        for y in benefic:
            lines.append(f"  ✦ {y['name']}")
            lines.append(f"    {y['description']}")
        lines.append("")

    if mixed:
        lines.append("Latent Power (activated through challenge):")
        for y in mixed:
            lines.append(f"  ✦ {y['name']}")
            lines.append(f"    {y['description']}")
        lines.append("")

    if challenging:
        lines.append("Challenges to work with:")
        for y in challenging:
            lines.append(f"  ⚠ {y['name']}")
            lines.append(f"    {y['description']}")

    return "\n".join(lines)


def format_yoga_block_roast(yogas: list[dict]) -> str:
    """
    Yoga block for the roast prompt.

    2026-08 · THE DESCRIPTIONS CAME BACK. They were dropped to save ~350 tokens
    on the theory that "Claude already knows what each yoga means". It does —
    but what it knows is the textbook meaning, which is written to flatter. The
    one-line descriptions here say what the combination does to a PERSON, and
    that is the raw material the roast is made of. Buying it back costs about
    250 tokens against a 1,600-token answer.
    """
    if not yogas:
        return "YOGAS: none detected."

    order = {"challenging": 0, "mixed": 1, "benefic": 2}
    tag   = {"challenging": "HARD", "mixed": "MIXED", "benefic": "GIFT"}
    lines = ["YOGAS — combinations active in this chart",
             "(HARD and MIXED are the useful ones. A GIFT is only funny when it "
             "is being wasted.)"]
    for y in sorted(yogas, key=lambda x: order.get(x["quality"], 3)):
        lines.append(f"  [{tag.get(y['quality'], '?')}] {y['name']}")
        lines.append(f"        {y['description']}")
    return "\n".join(lines)


# ─── Blocks that describe the person, not just the chart ─────────────────────

def format_person_block(birth_data: dict, birth_dt: datetime,
                        query_date: datetime) -> str:
    """
    Who this actually is. The single highest-value block in the prompt and the
    one that did not exist: age, name, gender and today's date were all either
    collected-and-discarded or never computed.

    Age matters more than any other fact here. The same chart at 24 and at 52
    is two completely different jokes, and without it the model can only write
    observations that would fit either.
    """
    bd   = birth_data or {}
    age  = (query_date - birth_dt).days / 365.25
    name = (bd.get("name") or "").strip()
    gen  = (bd.get("gender") or "").strip()

    lines = ["WHO THIS IS"]
    lines.append(f"Age today: {age:.0f}")
    if name:
        lines.append(f"Name: {name} — use it once, early. Never more than twice.")
    if gen:
        lines.append(f"Gender: {gen}")
    if bd.get("pob"):
        lines.append(f"Born: {bd['pob']}")
    lines.append(f"Today's date: {query_date.strftime('%d %B %Y')}")
    lines.append(
        f"Life stage anchor: write for someone who is {age:.0f}. The pressures, "
        "the comparisons and the specific embarrassments of that exact age are "
        "the material. Do not write for a generic adult."
    )
    return "\n".join(lines)


def format_transit_block(chart: dict, query_date: datetime) -> str:
    """
    What is happening RIGHT NOW. Natal-only roasts describe a permanent
    disposition, which is what makes them read like a horoscope. The current
    weather is what makes a reading feel like it was written today.
    """
    try:
        tr      = calculate_transits(query_date)
        d1      = chart["d1"]
        asc_idx = (d1["Moon"]["sign_idx"] - d1["Moon"]["house"] + 1) % 12
        lines   = ["WHAT IS HAPPENING RIGHT NOW (transits)"]

        press = saturn_pressure(d1["Moon"]["sign_idx"], tr["Saturn"]["sign_idx"])
        if press:
            lines.append(
                f"*** {press['name'].upper()} IS RUNNING — {press['phase']}. "
                f"{press['meaning']}. This is the loudest thing in their life "
                f"right now and they may not have a name for it. ***"
            )

        for p in ("Saturn", "Jupiter", "Rahu"):
            t = tr[p]
            house = (t["sign_idx"] - asc_idx) % 12 + 1
            natal = d1[p]["house"]
            lines.append(f"  transit {p}: {t['sign']} — crossing their H{house} "
                         f"(natal {p} sits in H{natal})")

        # Any transit sitting on a natal planet's sign is worth naming.
        hits = [f"transit {t} on natal {n}"
                for t in ("Saturn", "Jupiter", "Rahu", "Ketu")
                for n in CLASSICAL
                if tr[t]["sign_idx"] == d1[n]["sign_idx"]]
        if hits:
            lines.append("  direct hits: " + "; ".join(hits[:4]))
        return "\n".join(lines)
    except Exception as e:
        return f"WHAT IS HAPPENING RIGHT NOW: unavailable ({type(e).__name__})"


def format_karaka_block(chart: dict) -> str:
    """
    The Atmakaraka is the strongest single personality signal in a Vedic chart
    and it was being computed inside calculate_dominant_planet() and thrown
    away. Only the top three are sent — the rest is noise for comedy purposes.
    """
    ks = jaimini_karakas(chart)
    if not ks:
        return ""
    lines = ["SOUL SIGNATURE (Jaimini karakas — strongest first)"]
    for k in ks[:3]:
        d1 = chart["d1"][k["planet"]]
        flags = []
        if d1.get("debilitated"): flags.append("fallen")
        if d1.get("exalted"):     flags.append("exalted")
        if d1.get("retrograde"):  flags.append("retrograde")
        if d1.get("combust"):     flags.append("burnt by the Sun")
        f = f" [{', '.join(flags)}]" if flags else ""
        lines.append(f"  {k['karaka']}: {k['planet']} in {k['sign']} H{k['house']}{f}")
        lines.append(f"        governs {k['means']}")
    lines.append("  The Atmakaraka is the obsession they would deny having. Its "
                 "condition above is the condition of that obsession.")
    return "\n".join(lines)


def format_stack_block(chart: dict) -> str:
    """
    Houses holding three or more planets. A stack is the loudest structural
    feature a chart can have and nothing in the old prompt pointed at it — the
    model had to notice it by reading a table, which it mostly did not.
    """
    d1 = chart["d1"]
    by_house: dict[int, list[str]] = {}
    for p in PLANETS_ALL:
        by_house.setdefault(d1[p]["house"], []).append(p)
    HOUSE_MEANS = {
        1: "self, body, how they come across",   2: "money, family, speech",
        3: "courage, siblings, self-promotion",  4: "home, mother, peace of mind",
        5: "creativity, romance, children",      6: "work, debt, enemies, health",
        7: "partnership, marriage, the public",  8: "secrets, crises, other people's money",
        9: "belief, luck, father, teachers",    10: "career, status, reputation",
        11: "gains, friends, ambition",         12: "loss, isolation, foreign lands, the inner life",
    }
    stacks = [(h, ps) for h, ps in sorted(by_house.items()) if len(ps) >= 3]
    if not stacks:
        return ""
    lines = ["CONCENTRATIONS (three or more planets in one house)"]
    for h, ps in stacks:
        lines.append(f"  H{h} ({HOUSE_MEANS.get(h, '')}): {', '.join(ps)}")
    lines.append("  A stack means a disproportionate share of this person's whole "
                 "life happens in that one department. Say so.")
    return "\n".join(lines)


# ─── Roast-Me.me — Roast Prompt ──────────────────────────────────────────────

# ── 2026-08 · WHY THE PROMPT IS TWO BLOCKS ──────────────────────────────────
# Block 1 is byte-identical for every user of the app, so it can carry a
# cache_control breakpoint and be read back at 0.1x input price instead of
# being re-sent in full for every roast. Block 2 is this person's evidence plus
# the settings that vary (intensity, language), and it comes LAST — which is
# where a format constraint is actually obeyed.
#
# The old single template interleaved the two, so nothing could ever be cached
# and the JSON schema sat in the middle of the prompt rather than at the end.

ROAST_CRAFT_BLOCK = """\
You are a stand-up comedian doing a roast set built from someone's Vedic birth \
chart. You have done the homework, you have their whole chart in front of you, \
and you are about to tell them what it says about who they actually are.

WHAT MAKES THIS LAND
- Zero astrology jargon in the output. No planet names, no house numbers, no \
nakshatras, no Sanskrit, no sign names. Nothing technical. The chart is your \
evidence, not your vocabulary.
- Translate every placement into a HUMAN BEHAVIOUR, a LIFE PATTERN, or a \
SPECIFIC PERSONAL FAILING.
- Specificity is the entire punchline. "You overexplain yourself" is nothing. \
"You send a six-message voice note to clarify a one-line text" is the roast. \
Reach for the exact object: the notes app, the third rewritten message, the \
tab that has been open for nine days, the friend who stopped replying.
- The target is RECOGNITION, not damage. The best line is the one they read \
twice and screenshot. If a line would only hurt, it is the wrong line.
- Deadpan beats dramatic. Say the dark thing flatly and let it sit.
- Use their age. A pattern is funny because of where they are standing in \
their life, not in the abstract.
- Callbacks work. Set something up early, bury it, land it in the last point.
- The closer of each point is a verdict, not a joke. One clean sentence. No \
winking, no softening, no "but".

NEVER
- No comfort, no growth arc, no "but you're capable of great things".
- No filler: "the cosmos", "your journey", "latent potential", "the universe", \
"you are learning to", "inexplicably". Banned outright.
- No horoscope voice. No therapist voice. No astrologer voice.
- Never mention that you were given a chart, instructions, rules or data. \
Never narrate the format. Never explain the joke.
- Do not repeat the same insight in two different points.

OUTPUT — return ONLY valid JSON. No markdown fences, no preamble, no text \
after the closing brace.
{
  "cosmic_title": "4-7 words, brutally accurate, summarises their whole deal",
  "patterns": [
    {
      "title": "one emoji + a short title, e.g. \\ud83d\\udccb The Overexplainer",
      "body": "2-3 sentences. Specific, dark, funny. No fluff.",
      "closer": "One flat verdict sentence."
    }
  ]
}

RULES ON THE JSON
- Exactly 8 to 10 objects in "patterns".
- The final pattern is the grand unified theory: it ties every earlier point \
together into the one joke their whole life is running on.
- Every "title" starts with a single emoji, then a space, then the title.
- Keep every string on one line. No line breaks inside a JSON string.
"""


INTENSITY_BLOCK = {
    "Mild": (
        "INTENSITY: MILD. Affectionate roast. You like this person. Tease the "
        "pattern, do not indict them for it. Nothing here should sting for "
        "more than a second. Land closer to 'called out by a good friend' than "
        "'exposed'."
    ),
    "Spicy": (
        "INTENSITY: SPICY. The default. Sharp, deadpan, genuinely funny at "
        "their expense. Name the self-sabotage plainly. No comfort, but no "
        "cruelty either — every line should be something they would forward "
        "to a friend with 'ok this is too accurate'."
    ),
    "No Mercy": (
        "INTENSITY: NO MERCY. Go for the throat. Name the delusion they are "
        "actively maintaining, the excuse they have used for years, and the "
        "thing they are pretending not to know about themselves. Still funny, "
        "still true, still no cruelty for its own sake — but no exit either. "
        "They asked for this."
    ),
}


def build_roast_system_prompt(
    chart: dict,
    birth_dt: datetime,
    query_date: datetime = None,
    language:  str = "English",
    birth_data: dict = None,
    dominant_planet: str = "",
    intensity: str = "Spicy",
    as_blocks: bool = False,
):
    """
    Build the roast system prompt from a calculated chart.

    Parameters
    ----------
    chart           : Output of vedic_calc.calculate_chart()
    birth_dt        : Birth datetime in UTC (for dasha timing)
    query_date      : Date to evaluate current dashas/transits (default: today)
    language        : Output language for the roast
    birth_data      : {name, gender, pob, ...} from the session — used to make
                      the roast about a person rather than about a chart
    dominant_planet : The label shown to the user on the results page. Passed in
                      so the roast can be ABOUT that trait instead of
                      contradicting the badge sitting above it.
    intensity       : "Mild" | "Spicy" | "No Mercy"
    as_blocks       : True  -> [craft_block, evidence_block] for the API's
                      system array, so the craft block can be prompt-cached.
                      False -> one joined string (back-compatible).

    Returns
    -------
    str, or list[str] when as_blocks=True
    """
    if query_date is None:
        query_date = datetime.utcnow()

    from vedic_calc import format_for_prompt
    try:
        from vedic_calc import format_d1_only
        chart_block = format_d1_only(chart)
    except ImportError:
        chart_block = format_for_prompt(chart)

    moon_full_lon = chart["d1"]["Moon"]["sign_idx"] * 30 + chart["d1"]["Moon"]["degrees"]
    sequence      = calculate_vimshottari(moon_full_lon, birth_dt)
    dasha_block   = format_dasha_block_roast(sequence, query_date, birth_dt)
    yogas         = detect_yogas(chart)
    yoga_block    = format_yoga_block_roast(yogas)
    person_block  = format_person_block(birth_data, birth_dt, query_date)
    transit_block = format_transit_block(chart, query_date)
    karaka_block  = format_karaka_block(chart)
    stack_block   = format_stack_block(chart)

    language_note = (
        f"OUTPUT LANGUAGE: write the ENTIRE response in {language}, using its "
        f"natural script and grammar. The JSON keys stay in English."
        if language != "English" else
        "OUTPUT LANGUAGE: English."
    )

    dom_note = ""
    if dominant_planet:
        dom_note = (
            f"\nThe app has already told this person they are a "
            f"\"{dominant_planet}\" type, and that badge is on screen above your "
            f"roast. Make at least two points obviously consistent with it "
            f"without ever naming it."
        )

    evidence = "\n\n".join(filter(None, [
        "═══ EVIDENCE — for you to read, never to quote ═══",
        person_block,
        "BIRTH CHART",
        chart_block,
        stack_block,
        karaka_block,
        dasha_block,
        transit_block,
        yoga_block,
        "═══ SETTINGS FOR THIS ROAST ═══",
        INTENSITY_BLOCK.get(intensity, INTENSITY_BLOCK["Spicy"]),
        language_note.rstrip() + dom_note,
        "Now write it. 8 to 10 patterns. Valid JSON only, nothing before or "
        "after it.",
    ]))

    if as_blocks:
        return [ROAST_CRAFT_BLOCK, evidence]
    return ROAST_CRAFT_BLOCK + "\n\n" + evidence
