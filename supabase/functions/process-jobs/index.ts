// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function processStylesJob(inputData: any) {
  const { trackArtist, trackName } = inputData
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

  const prompt = `You are helping a DJ create stunning visuals for their set. 
  Given the track "${trackName}" by ${trackArtist}, suggest 5 unique and creative visual styles.
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
            content: 'You are an expert at creating detailed image prompts for AI art generation. Enhance the given prompt with rich visual details, lighting, composition, and artistic style while keeping it under 1000 characters. IMPORTANT: Do not include any DJs, stages, performers, or people in the visual. Focus on abstract visuals, colors, patterns, and atmospheric elements that would work as background visuals.'
          },
          {
            role: 'user',
            content: `Enhance this prompt for a background visual (no people, no DJ, no stage): ${prompt}`
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

  // Try gpt-image-1 first, then fall back to dall-e-3
  let imageData
  let modelUsed = 'gpt-image-1'
  
  try {
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

    if (imageResponse.ok) {
      imageData = await imageResponse.json()
    } else {
      throw new Error(`gpt-image-1 failed: ${imageResponse.statusText}`)
    }
  } catch (error) {
    console.log('gpt-image-1 failed, falling back to dall-e-3:', error.message)
    modelUsed = 'dall-e-3'
    
    const fallbackResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        n: 1,
        size: '1792x1024',
        quality: 'hd'
      })
    })

    if (!fallbackResponse.ok) {
      throw new Error(`Both gpt-image-1 and dall-e-3 failed. dall-e-3 error: ${fallbackResponse.statusText}`)
    }

    imageData = await fallbackResponse.json()
  }

  return {
    imageUrl: imageData.data[0].url,
    enhancedPrompt,
    revisedPrompt: imageData.data[0].revised_prompt || enhancedPrompt,
    modelUsed
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
            content: 'You are an expert at creating prompts for AI video generation. Create a prompt that describes motion and animation for abstract background visuals. IMPORTANT: Do not include any DJs, stages, performers, or people in the visual. Focus on abstract motion, colors, patterns, and atmospheric elements.'
          },
          {
            role: 'user',
            content: `Create a video generation prompt for this abstract background visual (no people, no DJ, no stage):
            Track: ${trackName}
            BPM: ${bpm}
            Phase: ${phase}
            Style: ${style}
            Base description: ${prompt}
            
            Focus on abstract motion, rhythm, and dynamic visual elements that sync with the music tempo.`
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    })

    if (enhanceResponse.ok) {
      const enhanceData = await enhanceResponse.json()
      videoPrompt = enhanceData.choices[0].message.content
      
      // Ensure prompt is under 1000 characters for Runway ML
      if (videoPrompt.length > 1000) {
        videoPrompt = videoPrompt.substring(0, 997) + '...'
      }
    }
  }

  // Ensure the video prompt is under 1000 characters as a final check
  if (videoPrompt.length > 1000) {
    videoPrompt = videoPrompt.substring(0, 997) + '...'
  }

  // Call Runway ML API with proper endpoint
  const runwayResponse = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
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
    const errorText = await runwayResponse.text()
    throw new Error(`Runway API error: ${runwayResponse.statusText} - ${errorText}`)
  }

  const runwayData = await runwayResponse.json()
  
  // Return immediately with the task ID - polling will happen separately
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