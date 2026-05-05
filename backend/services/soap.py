import json
import os
from services.rxnorm import check_interactions
from services.ner import extract_entities
from core.llm import LLM

llm = LLM()

SOAP_SCHEMA = {
    "subjective": "string - patient complaints, symptoms, history as reported",
    "objective": "string - vitals, physical exam findings, test results",
    "assessment": "string - diagnosis or differential diagnoses",
    "plan": "string - treatment plan, medications, procedures ordered",
    "medications": ["list of medication names mentioned (generic names, lowercase)"],
    "missing_fields": ["list of important fields that are missing or unclear"],
    "followup_questions": ["list of questions doctor should ask patient on next visit"],
    "plain_language_summary": "string - 2-3 sentence summary a patient can understand"
}

with open(os.path.join(os.path.dirname(__file__), "../prompts/SOAP_PROMPT.txt"), "r") as f:
    _SYSTEM_PROMPT_TEMPLATE = f.read()


def structure_soap(transcript: list[dict]) -> dict:
    """
    transcript: [{"speaker": "DOCTOR", "text": "..."}, ...]
    Returns structured SOAP dict
    """
    # Format transcript
    formatted = "\n".join(
        f"{turn['speaker']}: {turn['text']}"
        for turn in transcript
    )

    # --- Stage 5: Run NER on the transcript ---
    ner_result = extract_entities(transcript)
    entities = ner_result["entities"]

    # Build enriched entity context block for Claude
    entity_block = ""
    if entities:
        entity_block = f"""Pre-extracted medical entities (use these to populate SOAP fields accurately):
{json.dumps(entities, indent=2)}

"""

    # Inject schema into system prompt
    system_prompt = _SYSTEM_PROMPT_TEMPLATE.replace(
        "{{SOAP_SCHEMA}}", json.dumps(SOAP_SCHEMA, indent=2)
    )

    # Entity block goes before the transcript
    user_prompt = f"{entity_block}Transcript:\n\n{formatted}"

    # Call LLM
    soap = llm.generate_json(prompt=user_prompt, system_prompt=system_prompt)

    # --- Stage 6.5: Drug interaction check ---
    # Prefer NER-extracted drugs, fall back to Claude's own extraction
    if ner_result.get("all_drugs"):
        medications = ner_result["all_drugs"]
    else:
        medications = soap.get("medications", [])

    if len(medications) >= 2:
        interactions = check_interactions(medications)
        soap["drug_interactions"] = interactions
    else:
        soap["drug_interactions"] = []

    return soap


if __name__ == "__main__":
    test_transcript = [
    {"speaker": "DOCTOR", "text": "Ramesh ji, aiye aiye. Aaj kya taklif hai? Pehle se follow up tha na aapka?"},
    {"speaker": "PATIENT", "text": "Haan doctor saab, pichle hafte aaya tha. Woh jo dawa di thi metformin, usse pet mein bahut dard ho raha hai. Aur ab se do din pehle seene mein bhi dard shuru ho gaya hai."},
    {"speaker": "DOCTOR", "text": "Seene mein dard? Kaise dard hai? Andar se jalta hai ya daba ke dard hai?"},
    {"speaker": "PATIENT", "text": "Daba ke dard hai doctor saab. Aur thoda sa saanth lene mein bhi takleef hoti hai. Seedha letne par zyada hota hai."},
    {"speaker": "DOCTOR", "text": "Kitne din se hai yeh seene ka dard?"},
    {"speaker": "PATIENT", "text": "Do din se. Raat ko zyada hota hai."},
    {"speaker": "DOCTOR", "text": "Theek hai. Aapko diabetes hai pehle se, aur BP ki bhi dawai le rahe hain na? Kaunsi dawai chal rahi hai BP ke liye?"},
    {"speaker": "PATIENT", "text": "Haan, amlodipine le raha hoon, 5mg. Aur ek aur dawai thi — aspirin bhi diya tha cardio wale doctor ne, 75mg rozana."},
    {"speaker": "DOCTOR", "text": "Cardio doctor ne kab diya tha aspirin?"},
    {"speaker": "PATIENT", "text": "Chhe mahine pehle. Tab ECG karaya tha, unhone kaha tha thodi si blockage hai. Isliye aspirin chal rahi hai."},
    {"speaker": "DOCTOR", "text": "Okay. Aur metformin kitne din se le rahe hain?"},
    {"speaker": "PATIENT", "text": "Teen hafte se. 500mg, din mein do baar."},
    {"speaker": "DOCTOR", "text": "Koi aur dawai? Koi supplement ya herbal?"},
    {"speaker": "PATIENT", "text": "Haan, woh patanjali ka ashwagandha bhi leta hoon. Roz subah."},
    {"speaker": "DOCTOR", "text": "Theek hai. BP check karte hain... 145/92 aa raha hai, thoda high hai. Temperature normal hai. Oxygen 97 percent. Pulse 88."},
    {"speaker": "DOCTOR", "text": "Ramesh ji, yeh seene ka dard aur saanth mein takleef — mujhe lagta hai yeh GERD ho sakta hai, acid reflux. Metformin se bhi kabhi kabhi pet mein aur chest mein burning hoti hai. Lekin ek ECG karwana padega aaj, kyunki aapki cardiac history hai."},
    {"speaker": "PATIENT", "text": "Doctor saab, kuch serious toh nahi hai na?"},
    {"speaker": "DOCTOR", "text": "Abhi ghabrana mat. ECG normal aaya toh GERD treat karenge. Main aapko pantoprazole deta hoon, 40mg, subah khaana khane se aadha ghanta pehle. Metformin khane ke saath hi lena, khali pet nahi."},
    {"speaker": "DOCTOR", "text": "BP thoda high aa raha hai toh amlodipine 5mg se 10mg kar dete hain."},
    {"speaker": "PATIENT", "text": "Theek hai doctor saab."},
    {"speaker": "DOCTOR", "text": "Aspirin jaari rakhiye, band mat karna. Aur cigarette ya tobacco?"},
    {"speaker": "PATIENT", "text": "Nahi doctor, woh nahi karta."},
    {"speaker": "DOCTOR", "text": "Theek hai. Paani zyada pijiye. Tala hua, masaledar khaana kam kariye abhi kuch din. ECG report lekar kal subah aa jaiyega. Agar raat mein seene mein bahut zyada dard ho, ya saanth rukne lage, toh seedha emergency mein jaiyega, ghar mein mat rukna."},
]

    result = structure_soap(test_transcript)
    print(json.dumps(result, indent=2))