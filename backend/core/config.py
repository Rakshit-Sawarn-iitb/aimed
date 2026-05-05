from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    JWT_SECRET: str
    SUPABASE_DATABASE_URI: str
    GEMINI_API_KEY_1: str = ""
    GEMINI_API_KEY_2: str = ""
    SARVAM_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = ""

    class Config:
        env_file = ".env"

settings = Settings()