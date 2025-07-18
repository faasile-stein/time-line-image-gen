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
    const { imageUrl, prompt, trackName, bpm, phase, style } = await req.json()
    const RUNWAY_API_KEY = Deno.env.get('RUNWAY_API_KEY')
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

    if (!RUNWAY_API_KEY) {
      throw new Error('Runway API key not configured')
    }

    if (!imageUrl || !prompt) {
      return new Response(
        JSON.stringify({ error: 'Image URL and prompt are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // First, create an enhanced prompt for video generation
    let videoPrompt = prompt
    if (OPENAI_API_KEY) {
      const enhanceResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: 'You are an expert at creating prompts for AI video generation. Create a prompt that describes motion and animation for a DJ visual.'
            },
            {
              role: 'user',
              content: `Create a video generation prompt for this DJ visual:
              Track: ${trackName}
              BPM: ${bpm}
              Phase: ${phase}
              Style: ${style}
              Base description: ${prompt}
              
              Focus on motion, rhythm, and dynamic elements that sync with the music.`
            }
          ],
          temperature: 0.7,
          max_tokens: 200
        })
      })

      if (enhanceResponse.ok) {
        const enhanceData = await enhanceResponse.json()
        videoPrompt = enhanceData.choices[0].message.content
      }
    }

    // Call Runway ML API
    const runwayResponse = await fetch('https://api.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNWAY_API_KEY}`,
        'X-Runway-Version': '2024-11-06'
      },
      body: JSON.stringify({
        model: 'gen4_turbo',
        promptImage: imageUrl,
        promptText: videoPrompt,
        duration: 5,
        ratio: '1280:720'
      })
    })

    if (!runwayResponse.ok) {
      const error = await runwayResponse.text()
      throw new Error(`Runway API error: ${runwayResponse.statusText} - ${error}`)
    }

    const runwayData = await runwayResponse.json()

    return new Response(
      JSON.stringify({ 
        taskId: runwayData.id,
        status: 'processing',
        videoPrompt
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error generating video:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate video' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})