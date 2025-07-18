// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { trackName, style } = await req.json()
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }

    if (!trackName || !style) {
      return new Response(
        JSON.stringify({ error: 'Track name and style are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const prompt = `Analyze the track "${trackName}" and provide:
    1. The estimated BPM (beats per minute) - provide a single number between 60-200
    2. The song phases present in typical electronic/dance music
    
    Return a JSON object with:
    - bpm: number
    - phases: array of phase names (typically: intro, buildup, drop, breakdown, outro)
    
    Example: {"bpm": 128, "phases": ["intro", "buildup", "drop", "breakdown", "outro"]}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a music expert specializing in electronic and dance music. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 200
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.statusText} - ${error}`)
    }

    const data = await response.json()
    const trackInfo = JSON.parse(data.choices[0].message.content)

    return new Response(
      JSON.stringify(trackInfo),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error analyzing track:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to analyze track' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})