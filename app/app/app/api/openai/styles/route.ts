import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { trackNumber, trackName } = await request.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const prompt = `You are helping a DJ create stunning visuals for their set. 
    Given the track "${trackName}" (Track #${trackNumber}), suggest 5 unique and creative visual styles.
    Each style should be visually distinct and suitable for live DJ performance visuals.
    Always include "Rainbow Vomit" as the 5th option.
    
    Return only a JSON array of 5 style names, each 3-5 words long.
    Example: ["Cyberpunk Neon Dreams", "Abstract Geometric Patterns", "Ethereal Space Journey", "Psychedelic Color Waves", "Rainbow Vomit"]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
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
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const styles = JSON.parse(data.choices[0].message.content);

    return NextResponse.json({ styles });
  } catch (error) {
    console.error('Error generating styles:', error);
    return NextResponse.json(
      { error: 'Failed to generate styles' },
      { status: 500 }
    );
  }
}