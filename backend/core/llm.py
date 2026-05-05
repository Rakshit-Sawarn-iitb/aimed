import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

class LLM:
    def __init__(self, model_name: str = "gemini-2.5-flash"):
        self.model_name = model_name
        self._setup_client()

    def _setup_client(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        genai.configure(api_key=api_key)
        self.client = genai.GenerativeModel(self.model_name)

    def generate_response(self, prompt: str, system_prompt: str = None) -> str:
        """
        Generate a plain text response.
        """
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        response = self.client.generate_content(full_prompt)
        return response.text.strip()

    def generate_json(self, prompt: str, system_prompt: str = None) -> dict:
        """
        Generate a response and parse it as JSON.
        Use this for structured extraction tasks (NER, SOAP etc.)
        """
        json_system = (system_prompt or "") + "\nYou must respond with valid JSON only. No markdown, no backticks, no explanation."
        full_prompt = f"{json_system}\n\n{prompt}"
        
        response = self.client.generate_content(full_prompt)
        raw = response.text.strip()

        # Strip markdown code fences if model adds them anyway
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        return json.loads(raw)
    
if __name__ == "__main__":
    llm = LLM()
    prompt = "What is the capital of France?"
    print(llm.generate_response(prompt))
    
    json_prompt = "Extract the following information about Paris: population, area, and official language."
    print(llm.generate_json(json_prompt))