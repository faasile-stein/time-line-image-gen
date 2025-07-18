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
    const { prompt, regenerate } = await req.json()
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // First, enhance the prompt if not regenerating
    let enhancedPrompt = prompt
    if (!regenerate) {
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
              content: 'You are an expert at creating detailed image prompts for AI art generation. Enhance the given prompt with rich visual details, lighting, composition, and artistic style while keeping it under 1000 characters.'
            },
            {
              role: 'user',
              content: `Enhance this prompt for a DJ visual: ${prompt}`
            }
          ],
          temperature: 0.7,
          max_tokens: 300
        })
      })

      if (enhanceResponse.ok) {
        const enhanceData = await enhanceResponse.json()
        enhancedPrompt = enhanceData.choices[0].message.content
      }
    }

    // Generate the image
    const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: enhancedPrompt,
        n: 1,
        size: '1792x1024',
        quality: 'hd',
        moderation: 'auto'
      })
    })

    if (!imageResponse.ok) {
      const error = await imageResponse.text()
      throw new Error(`OpenAI API error: ${imageResponse.statusText} - ${error}`)
    }

    const imageData = await imageResponse.json()
    const imageUrl = imageData.data[0].url

    return new Response(
      JSON.stringify({ 
        imageUrl,
        enhancedPrompt,
        revisedPrompt: imageData.data[0].revised_prompt
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error generating image:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate image' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})