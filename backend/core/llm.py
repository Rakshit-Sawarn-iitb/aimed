import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

class LLM:
    def __init__(self, model_name: str = "gemini-2.5-flash"):
        self.model_name = model_name
        self._current_key_index = 0
        self._api_keys = self._load_keys()
        self._setup_client()

    def _load_keys(self) -> list[str]:
        keys = []
        key1 = os.getenv("GEMINI_API_KEY_1")
        key2 = os.getenv("GEMINI_API_KEY_2")
        if key1:
            keys.append(key1)
        if key2:
            keys.append(key2)
        if not keys:
            raise ValueError("No GEMINI API keys found. Set GEMINI_API_KEY_1 in .env")
        return keys

    def _setup_client(self):
        api_key = self._api_keys[self._current_key_index]
        genai.configure(api_key=api_key)
        self.client = genai.GenerativeModel(self.model_name)
        print(f"[LLM] Using API key #{self._current_key_index + 1}")

    def _switch_key(self):
        next_index = self._current_key_index + 1
        if next_index >= len(self._api_keys):
            raise RuntimeError("All Gemini API keys are rate limited. Try again later.")
        self._current_key_index = next_index
        self._setup_client()

    def _is_rate_limit_error(self, e: Exception) -> bool:
        return "429" in str(e) or "quota" in str(e).lower() or "rate" in str(e).lower()

    def generate_response(self, prompt: str, system_prompt: str = None) -> str:
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        try:
            response = self.client.generate_content(full_prompt)
            return response.text.strip()
        except Exception as e:
            if self._is_rate_limit_error(e):
                print(f"[LLM] Rate limit on key #{self._current_key_index + 1}, switching...")
                self._switch_key()
                return self.generate_response(prompt, system_prompt)
            raise

    def generate_json(self, prompt: str, system_prompt: str = None) -> dict:
        json_system = (system_prompt or "") + "\nYou must respond with valid JSON only. No markdown, no backticks, no explanation."
        full_prompt = f"{json_system}\n\n{prompt}"

        try:
            response = self.client.generate_content(full_prompt)
            raw = response.text.strip()

            # Strip markdown code fences if model adds them anyway
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            raw = raw.strip()

            return json.loads(raw)

        except Exception as e:
            if self._is_rate_limit_error(e):
                print(f"[LLM] Rate limit on key #{self._current_key_index + 1}, switching...")
                self._switch_key()
                return self.generate_json(prompt, system_prompt)
            raise


if __name__ == "__main__":
    llm = LLM()
    prompt = "What is the capital of France?"
    print(llm.generate_response(prompt))

    json_prompt = "Extract the following information about Paris: population, area, and official language."
    print(llm.generate_json(json_prompt))