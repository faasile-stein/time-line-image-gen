# time-line.io Visual Generator

AI-powered visual generator for DJ sets using OpenAI and Runway ML.

## Features

- Track information input (number and name)
- AI-generated visual style suggestions (always includes "Rainbow Vomit" option)
- Automatic BPM and phase detection
- AI-generated images based on track, style, and phase
- Video generation from images using Runway ML
- Secure API key management via Supabase Edge Functions

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ installed
- Supabase account
- OpenAI API key
- Runway ML API key

### 2. Install Dependencies

```bash
cd app/app
npm install
```

### 3. Set up Supabase

1. Create a new Supabase project at https://supabase.com

2. Install Supabase CLI:
```bash
npm install -g supabase
```

3. Link your project:
```bash
supabase link --project-ref your-project-ref
```

4. Set up environment variables in Supabase:
```bash
supabase secrets set OPENAI_API_KEY=your_openai_api_key
supabase secrets set RUNWAY_API_KEY=your_runway_api_key
```

5. Deploy the Edge Functions:
```bash
supabase functions deploy get-styles
supabase functions deploy get-track-info
supabase functions deploy generate-image
supabase functions deploy generate-video
```

### 4. Configure Frontend

1. Copy the environment template:
```bash
cp .env.local.example .env.local
```

2. Update `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. Run the Application

```bash
npm run dev
```

Visit http://localhost:3000 to use the application.

## Usage

1. Enter a track number and name
2. Select a visual style from AI suggestions
3. Choose the song phase (intro, buildup, drop, etc.)
4. Review and edit the generated image prompt
5. Generate a video from the image

## Architecture

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Supabase Edge Functions (Deno)
- **AI Services**: 
  - OpenAI GPT-4 for style suggestions and prompt enhancement
  - OpenAI GPT-4o (gpt-image-1) for image generation
  - Runway ML Gen-4 Turbo for video generation

## Security

All API keys are securely stored in Supabase Edge Functions environment variables and never exposed to the frontend.