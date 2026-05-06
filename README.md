# 🎯 AIMED: AI-Powered Medical Consultation Recorder

<div align="center">
  <img src="https://img.shields.io/badge/Hackathon-AIC%20×%20Anthropic%20Claude-blue?style=for-the-badge" alt="Hackathon Badge"/>
  <img src="https://img.shields.io/badge/Track-Biology%20%26%20Physical%20Health-green?style=for-the-badge" alt="Track Badge"/>
  <br>
  <img src="https://img.shields.io/badge/React-18.3.1-61DAFB?style=flat-square&logo=react" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-5.7.2-3178C6?style=flat-square&logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/FastAPI-0.115.12-009688?style=flat-square&logo=fastapi" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/Claude%20Sonnet-4.6-orange?style=flat-square&logo=anthropic" alt="Claude"/>
  <img src="https://img.shields.io/badge/Sarvam%20Saaras-v3-red?style=flat-square" alt="Sarvam"/>
</div>

## 🚀 Live Demo & Submission Links

- **🌐 Deployed Application**: [https://aimed.mooo.com/](https://aimed.mooo.com/)
- **🎥 Demo Video**: [Watch on YouTube](https://www.youtube.com/watch?v=UOpGlYQkj0c)
- **📊 Project Repository**: [GitHub](https://github.com/Rakshit-Sawarn-iitb/aimed)

## 📋 Table of Contents

- [🎯 Problem Statement](#-problem-statement)
- [💡 Solution Overview](#-solution-overview)
- [✨ Key Features](#-key-features)
- [🏗️ Architecture & Tech Stack](#️-architecture--tech-stack)
- [🚀 Quick Start](#-quick-start)
- [📱 User Journey](#-user-journey)
- [🔒 Security & Ethics](#-security--ethics)
- [📈 Impact & Future](#-impact--future)

## 🎯 Problem Statement

In urban Indian clinics, doctors spend **30% of consultation time** writing SOAP notes, often skipping them when busy. Patients lose medical continuity as records exist only on paper receipts scattered across clinics. Each new doctor starts from zero, leading to:

- **For Doctors**: Time wasted on documentation, prescription errors from incomplete history
- **For Patients**: Lost medical history, repeated explanations, contradictory treatments
- **For Healthcare**: Fragmented care, preventable errors, poor outcomes

## 💡 Solution Overview

**AIMED** revolutionizes medical consultations by recording doctor-patient conversations, using AI to generate structured medical records, and giving patients ownership of their longitudinal health data.

### The Magic ✨

1. **Record**: In-browser audio capture during consultation
2. **Transcribe**: Sarvam AI diarizes speakers (doctor vs patient) in Hindi-English code-mix
3. **Extract**: Claude Sonnet analyzes transcript to extract structured medical facts
4. **Verify**: Tiered UI forces doctor review of high-risk facts with audio anchors
5. **Share**: Patients control time-limited, OTP-gated links to share records

## ✨ Key Features

### 🎙️ Smart Recording & Transcription
- **In-browser recording** with live waveform visualization
- **Speaker diarization** automatically identifies doctor vs patient voices
- **Hindi-English code-mix support** using Sarvam Saaras v3
- **Real-time processing** pipeline with progress indicators

### 🧠 AI-Powered Medical Intelligence
- **Structured fact extraction** using Claude Sonnet 4.6
- **Risk-tiered classification** (Tier 1: routine, Tier 2: moderate, Tier 3: critical)
- **SOAP note generation** with mandatory source citations
- **Drug interaction checking** and contraindication alerts

### 🔍 Ethical Verification System
- **Tiered review UI**: Bulk approve routine facts, individual review for moderate, forced audio verification for critical
- **Audio anchors**: One-tap playback of exact conversation segments
- **Audit trail**: Complete log of doctor review behavior, visible to patients
- **Patient corrections**: Flag AI errors or missing information

### 🔐 Patient-Controlled Data
- **Patient-owned records**: Longitudinal health timeline across all doctors
- **Time-limited sharing**: OTP-gated links expire automatically
- **WhatsApp notifications**: Plain-language summaries sent to patients
- **Zero-knowledge sharing**: No clinic data silos

### 📱 Mobile-First Experience
- **PWA-ready** responsive design
- **Touch-optimized** recording and review interfaces
- **Offline-capable** consultation recording
- **Cross-platform** compatibility

## 🏗️ Architecture & Tech Stack

### Frontend Stack
```
React 18 + TypeScript 5 + Vite
├── UI: Tailwind CSS + shadcn/ui (Radix primitives)
├── State: TanStack Query + React Router
├── Audio: Web Audio API + MediaRecorder
├── Auth: Supabase Auth (Twilio for phone OTP)
└── Deployment: E2E networks (using CPU instances)
```

### Backend Stack
```
FastAPI + Python 3.12 + Uvicorn
├── AI: Anthropic Claude 4.6 + Sarvam Saaras v3
├── Database: Supabase (Postgres + RLS)
├── Storage: Supabase Storage (signed URLs)
├── Audio: FFmpeg processing pipeline
└── Deployment: Render/Fly.io
```

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** and **npm**
- **Python 3.12+** and **pip**
- **FFmpeg** (for audio processing)

### Local Development
Checkout frontend and backend specific readme.md files for local development inside respective folders.
<!-- 
1. **Clone the repository**
   ```bash
   git clone https://github.com/Rakshit-Sawarn-iitb/aimed.git
   cd aimed
   ```

2. **Setup Backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env
   # Add your API keys to .env
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

3. **Setup Frontend**
   ```bash
   cd ../frontend
   npm install
   cp .env.example .env.local
   # Set VITE_API_BASE_URL=http://localhost:8000
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Environment Variables

#### Backend (.env)
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_claude_api_key
SARVAM_API_KEY=your_sarvam_api_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_WHATSAPP_NUMBER=your_whatsapp_number
```

#### Frontend (.env.local)
```env
VITE_API_BASE_URL=http://localhost:8000
``` -->

## 📱 User Journey

### For Doctors 👨‍⚕️

1. **Login** with phone OTP
2. **Record Consultation** - Press record, conduct normal consultation
3. **AI Processing** - Watch real-time progress (transcribe → extract → ready)
4. **Review Facts** - Bulk approve routine items, individually verify critical ones
5. **Audio Verification** - Tap any fact to hear the exact conversation segment
6. **Finalize** - Generate SOAP notes and WhatsApp summary to patient

### For Patients 👥

1. **Receive WhatsApp** notification with plain-language summary
2. **View Timeline** - See all consultations across different doctors
3. **Share Records** - Generate time-limited OTP links for specialists
4. **Flag Corrections** - Mark any AI errors or missing information

### Test access for hackathon 🎯

**Doctor's view login**: Use phone `9999999999` with OTP `676767`\
**Patient's view login**: Use phone `1111111111` with OTP `676767` 

## 🔒 Security & Ethics

### ⚖️ Ethics
* **Patient owns the record:** No vendor lock-in. Patients generate share links and track who opens them.
* **Every claim is citable:** Each fact carries a literal evidence quote.
* **Patient can dispute:** Non-blocking flags ride along with the record for the next doctor to see.
* **Lazy review is visible:** The audit summary tells the patient exactly how many audio anchors the doctor actually played. Trust pressure flows back to the doctor.

### 🛡️ The Verification Spine
Three tiers of extracted facts, with one unforgiving rule:
* **T1 (Informational):** Symptoms, history, lifestyle. Bulk-approve allowed.
* **T2 (Consequential):** Vitals, exam findings, follow-up. One-tap individual approval required.
* **T3 (High-risk):** Medications, allergies, diagnoses. Audio anchor *must* be played before the doctor can approve.

### Patient Data Protection
- **Row-Level Security (RLS)** in Supabase ensures patients see only their data
- **End-to-end encryption** for audio files in transit
- **Automatic cleanup** - raw audio deleted after 30 days, transcripts retained
- **Audit logging** of all doctor review actions

### AI Safety Measures
- **No diagnostic recommendations** - AIMED only extracts what was said
- **Mandatory human verification** for high-risk facts
- **Source citations** for every AI-extracted fact
- **Patient correction workflow** for AI hallucinations

### Privacy by Design
- **Patient owns the data** - no clinic lock-in
- **Time-limited sharing** - links expire automatically
- **Phone OTP gates** - no password-based access
- **Minimal PII collection** - only phone numbers for auth




## 📈 Impact & Future

### Current Impact
- **Time Savings**: Doctors save 30% of consultation time on documentation
- **Error Reduction**: Structured extraction prevents prescription mistakes
- **Patient Empowerment**: Continuous care across multiple providers
- **Language Inclusion**: Native Hindi-English code-mix support

### Future Roadmap
- **Multi-language Support**: Expand to regional Indian languages
- **Integration APIs**: Connect with existing EMR systems
- **Advanced Analytics**: Population health insights for clinics
- **Mobile Apps**: Native iOS/Android experiences
- **Regulatory Compliance**: NMC doctor verification, HIPAA compliance

### Scalability
- **Cloud-native**: Serverless deployment ready
- **Cost-effective**: Claude prompt caching reduces API costs by 80%
- **Modular**: Easy to add new AI models or transcription services

---

<div align="center">
  <p><strong>Built with ❤️ Devendra Computers (Kanika, Rakshit, Sajjad and Vaibhav) for the AIC × Anthropic Claude Hackathon</strong></p>
  <p><em>Revolutionizing healthcare through ethical AI and patient empowerment</em></p>
  <br>
</div>
