// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function processStylesJob(inputData: any) {
  const { trackNumber, trackName } = inputData
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

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
    throw new Error(`OpenAI API error: ${response.statusText}`)
  }

  const data = await response.json()
  return { styles: JSON.parse(data.choices[0].message.content) }
}

async function processTrackInfoJob(inputData: any) {
  const { trackName, style } = inputData
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

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
    throw new Error(`OpenAI API error: ${response.statusText}`)
  }

  const data = await response.json()
  return JSON.parse(data.choices[0].message.content)
}

async function processImageJob(inputData: any) {
  const { prompt, regenerate } = inputData
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

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
    throw new Error(`OpenAI API error: ${imageResponse.statusText}`)
  }

  const imageData = await imageResponse.json()
  return {
    imageUrl: imageData.data[0].url,
    enhancedPrompt,
    revisedPrompt: imageData.data[0].revised_prompt
  }
}

async function processVideoJob(inputData: any) {
  const { imageUrl, prompt, trackName, bpm, phase, style } = inputData
  const RUNWAY_API_KEY = Deno.env.get('RUNWAY_API_KEY')
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

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
    throw new Error(`Runway API error: ${runwayResponse.statusText}`)
  }

  const runwayData = await runwayResponse.json()
  return {
    taskId: runwayData.id,
    status: 'processing',
    videoPrompt
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { jobId } = await req.json()
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get the job
    const { data: job, error: fetchError } = await supabaseClient
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch job: ${fetchError.message}`)
    }

    // Update job status to processing
    await supabaseClient
      .from('jobs')
      .update({ status: 'processing' })
      .eq('id', jobId)

    let result
    try {
      // Process the job based on type
      switch (job.type) {
        case 'get-styles':
          result = await processStylesJob(job.input_data)
          break
        case 'get-track-info':
          result = await processTrackInfoJob(job.input_data)
          break
        case 'generate-image':
          result = await processImageJob(job.input_data)
          break
        case 'generate-video':
          result = await processVideoJob(job.input_data)
          break
        default:
          throw new Error(`Unknown job type: ${job.type}`)
      }

      // Update job with results
      await supabaseClient
        .from('jobs')
        .update({
          status: 'completed',
          output_data: result,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId)

      return new Response(
        JSON.stringify({ success: true, result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (processingError) {
      console.error('Job processing error:', processingError)
      
      // Update job with error
      await supabaseClient
        .from('jobs')
        .update({
          status: 'failed',
          error_message: processingError.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId)

      throw processingError
    }

  } catch (error) {
    console.error('Error in process-jobs:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})