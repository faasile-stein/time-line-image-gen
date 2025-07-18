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
    const { trackNumber, trackName } = await req.json()
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }

    if (!trackNumber || !trackName) {
      return new Response(
        JSON.stringify({ error: 'Track number and name are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const prompt = `You are helping a DJ create stunning visuals for their set. 
    Given the track "${trackName}" (Track #${trackNumber}), suggest 5 unique and creative visual styles.
    Each style should be visually distinct and suitable for live DJ performance visuals.
    Always include "Rainbow Vomit" as the 5th option.
    
    Return only a JSON array of 5 style names, each 3-5 words long.
    Example: ["Cyberpunk Neon Dreams", "Abstract Geometric Patterns", "Ethereal Space Journey", "Psychedelic Color Waves", "Rainbow Vomit"]`

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
            content: 'You are a creative visual artist specializing in DJ performance visuals. Always respond with valid JSON arrays.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 200
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.statusText} - ${error}`)
    }

    const data = await response.json()
    const styles = JSON.parse(data.choices[0].message.content)

    return new Response(
      JSON.stringify({ styles }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error generating styles:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate styles' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})