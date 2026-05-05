import httpx

OPENFDA_BASE = "https://api.fda.gov/drug"
RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST"


def get_rxcui(drug_name: str) -> str | None:
    """RxCUI lookup still works fine — only interaction API was discontinued."""
    try:
        response = httpx.get(
            f"{RXNORM_BASE}/rxcui.json",
            params={"name": drug_name, "search": 1},
            timeout=5.0
        )
        data = response.json()
        rxcui = data.get("idGroup", {}).get("rxnormId", [])
        return rxcui[0] if rxcui else None
    except Exception as e:
        #print(f"[RxNorm] ERROR looking up '{drug_name}': {e}")
        return None


def get_fda_interactions(drug_name: str) -> list[str]:
    """
    Query OpenFDA for drug interaction warnings from official drug labels.
    Returns a list of interaction warning strings for this drug.
    """
    try:
        response = httpx.get(
            f"{OPENFDA_BASE}/label.json",
            params={
                "search": f'openfda.generic_name:"{drug_name}"',
                "limit": 1
            },
            timeout=8.0
        )
        if response.status_code != 200:
            return []

        data = response.json()
        results = data.get("results", [])
        if not results:
            return []

        # FDA labels have a dedicated drug_interactions field
        label = results[0]
        interactions = label.get("drug_interactions", [])
        return interactions

    except Exception as e:
        #print(f"[FDA] ERROR fetching label for '{drug_name}': {e}")
        return []


def check_interactions(drug_names: list[str]) -> list[dict]:
    """
    For each drug, fetch its FDA label interaction warnings.
    Filter to only show warnings that mention another drug in our list.
    """
    verified_drugs = []
    for drug in drug_names:
        rxcui = get_rxcui(drug)
        if rxcui:
            verified_drugs.append(drug)
        else:
            print(f"[RxNorm] No RxCUI for '{drug}' — skipping (likely supplement/herbal)")

    if len(verified_drugs) < 2:
        return []

    #print(f"[RxNorm] Checking interactions for: {verified_drugs}")

    interactions = []

    for drug in verified_drugs:
        other_drugs = [d for d in verified_drugs if d.lower() != drug.lower()]
        
        #print(f"[FDA] Fetching interaction label for: {drug}")
        warnings = get_fda_interactions(drug)

        for warning_text in warnings:
            # Check if this warning mentions any other drug in our list
            warning_lower = warning_text.lower()
            for other in other_drugs:
                if other.lower() in warning_lower:
                    interaction = {
                        "drugs": [drug, other],
                        "severity": "warning",  # FDA labels don't always specify severity
                        "description": warning_text[:300]  # truncate long warnings
                    }
                    # Deduplicate — same pair might be found from both directions
                    pair = set([drug.lower(), other.lower()])
                    already_added = any(
                        set([i["drugs"][0].lower(), i["drugs"][1].lower()]) == pair
                        for i in interactions
                    )
                    if not already_added:
                        #print(f"[FDA] ✓ Interaction found: {drug} ↔ {other}")
                        interactions.append(interaction)

    return interactions


if __name__ == "__main__":
    drugs = ["atorvastatin", "clarithromycin"]
    result = check_interactions(drugs)

    print("\n── FINAL RESULT ──")
    if result:
        for i in result:
            print(f"⚠️  {i['drugs']}")
            print(f"   {i['description']}\n")
    else:
        print("No interactions found")