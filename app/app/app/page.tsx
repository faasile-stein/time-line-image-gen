'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Music, Sparkles, Palette, Loader2, Image as ImageIcon, Video, Clock, CheckCircle } from 'lucide-react';
import { supabaseFunctions, Job } from '../lib/supabase';

type Phase = 'intro' | 'buildup' | 'drop' | 'breakdown' | 'outro';
type Style = string;

interface TrackInfo {
  number: string;
  name: string;
}

export default function Home() {
  const [step, setStep] = useState<'track' | 'styles' | 'phase' | 'image' | 'video'>('track');
  const [trackInfo, setTrackInfo] = useState<TrackInfo>({ number: '', name: '' });
  const [suggestedStyles, setSuggestedStyles] = useState<Style[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<Style>('');
  const [bpm, setBpm] = useState<number>(0);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);
  const [imagePrompt, setImagePrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [progressMessage, setProgressMessage] = useState('');

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackInfo.number || !trackInfo.name) return;
    
    setIsLoading(true);
    setProgressMessage('Getting AI style suggestions...');
    
    try {
      const styles = await supabaseFunctions.getStyles(trackInfo.number, trackInfo.name);
      setSuggestedStyles(styles);
      setStep('styles');
    } catch (error) {
      console.error('Error getting style suggestions:', error);
      alert('Failed to get style suggestions. Please check your Supabase configuration.');
    } finally {
      setIsLoading(false);
      setProgressMessage('');
      setCurrentJob(null);
    }
  };

  const handleStyleSelect = async (style: Style) => {
    setSelectedStyle(style);
    setIsLoading(true);
    setProgressMessage('Analyzing track BPM and phases...');
    
    try {
      const trackAnalysis = await supabaseFunctions.getTrackInfo(trackInfo.name, style);
      setBpm(trackAnalysis.bpm);
      setPhases(trackAnalysis.phases as Phase[]);
      setStep('phase');
    } catch (error) {
      console.error('Error getting BPM and phases:', error);
      alert('Failed to analyze track. Please try again.');
    } finally {
      setIsLoading(false);
      setProgressMessage('');
      setCurrentJob(null);
    }
  };

  const handlePhaseSelect = async (phase: Phase) => {
    setSelectedPhase(phase);
    setIsLoading(true);
    setProgressMessage('Creating enhanced prompt...');
    
    try {
      const prompt = `A stunning visual for a DJ set during the ${phase} phase of "${trackInfo.name}" at ${bpm} BPM in ${selectedStyle} style`;
      setImagePrompt(prompt);
      
      const imageData = await supabaseFunctions.generateImage(prompt, false, (job) => {
        setCurrentJob(job);
        if (job.status === 'processing') {
          setProgressMessage('Generating image with DALL-E 3...');
        }
      });
      
      setGeneratedImage(imageData.imageUrl);
      setImagePrompt(imageData.enhancedPrompt);
      setStep('image');
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Failed to generate image. Please check your API configuration.');
    } finally {
      setIsLoading(false);
      setProgressMessage('');
      setCurrentJob(null);
    }
  };

  const handleGenerateVideo = async () => {
    setIsLoading(true);
    setProgressMessage('Preparing video generation...');
    
    try {
      if (!generatedImage || !selectedPhase) return;
      
      const videoData = await supabaseFunctions.generateVideo(
        generatedImage,
        imagePrompt,
        trackInfo.name,
        bpm,
        selectedPhase,
        selectedStyle,
        (job) => {
          setCurrentJob(job);
          if (job.status === 'processing') {
            setProgressMessage('Generating video with Runway ML...');
          }
        }
      );
      
      setStep('video');
    } catch (error) {
      console.error('Error generating video:', error);
      alert('Failed to generate video. Please check your Runway ML configuration.');
    } finally {
      setIsLoading(false);
      setProgressMessage('');
      setCurrentJob(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-4">time-line.io Visual Generator</h1>
          <p className="text-lg text-muted-foreground">Create stunning AI-powered visuals for your DJ sets</p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          {/* Progress Indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 bg-card p-4 rounded-lg shadow-lg border border-border"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {currentJob?.status === 'pending' && <Clock className="w-5 h-5 text-yellow-500" />}
                  {currentJob?.status === 'processing' && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
                  {currentJob?.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {!currentJob && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{progressMessage}</p>
                  {currentJob && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Status: {currentJob.status} • Created: {new Date(currentJob.createdAt).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {step === 'track' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-card p-8 rounded-lg shadow-lg"
            >
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <Music className="w-6 h-6" />
                Track Information
              </h2>
              <form onSubmit={handleTrackSubmit} className="space-y-4">
                <div>
                  <label htmlFor="track-number" className="block text-sm font-medium mb-2">
                    Track Number
                  </label>
                  <input
                    id="track-number"
                    type="text"
                    value={trackInfo.number}
                    onChange={(e) => setTrackInfo({ ...trackInfo, number: e.target.value })}
                    className="w-full px-4 py-2 rounded-md bg-background border border-input focus:border-primary focus:outline-none"
                    placeholder="e.g., 001"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="track-name" className="block text-sm font-medium mb-2">
                    Track Name
                  </label>
                  <input
                    id="track-name"
                    type="text"
                    value={trackInfo.name}
                    onChange={(e) => setTrackInfo({ ...trackInfo, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-md bg-background border border-input focus:border-primary focus:outline-none"
                    placeholder="e.g., Midnight Dreams"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                  ) : (
                    <>Continue <Sparkles className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            </motion.div>
          )}

          {step === 'styles' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-card p-8 rounded-lg shadow-lg"
            >
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <Palette className="w-6 h-6" />
                Select Visual Style
              </h2>
              <div className="space-y-3">
                {suggestedStyles.map((style, index) => (
                  <motion.button
                    key={style}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => handleStyleSelect(style)}
                    className="w-full p-4 rounded-md bg-background border border-input hover:border-primary hover:bg-accent transition-all text-left group"
                  >
                    <span className="font-medium group-hover:text-primary transition-colors">
                      {style}
                    </span>
                    {style === 'Rainbow Vomit' && (
                      <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                        🌈 Special
                      </span>
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'phase' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-card p-8 rounded-lg shadow-lg"
            >
              <h2 className="text-2xl font-semibold mb-2">Select Song Phase</h2>
              <p className="text-muted-foreground mb-6">BPM: {bpm}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {phases.map((phase) => (
                  <motion.button
                    key={phase}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handlePhaseSelect(phase)}
                    className="p-4 rounded-md bg-background border border-input hover:border-primary hover:bg-accent transition-all capitalize font-medium"
                  >
                    {phase}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'image' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-card p-8 rounded-lg shadow-lg"
            >
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <ImageIcon className="w-6 h-6" />
                Generated Image
              </h2>
              <div className="space-y-4">
                <div className="bg-background p-4 rounded-md">
                  <p className="text-sm text-muted-foreground mb-2">Prompt:</p>
                  <textarea
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    className="w-full p-2 bg-transparent resize-none focus:outline-none"
                    rows={3}
                  />
                </div>
                {generatedImage && (
                  <div className="aspect-video bg-muted rounded-md overflow-hidden">
                    <img
                      src={generatedImage}
                      alt="Generated visual"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex gap-4">
                  <button
                    onClick={async () => {
                      setIsLoading(true);
                      setProgressMessage('Regenerating image...');
                      try {
                        const imageData = await supabaseFunctions.generateImage(imagePrompt, true, (job) => {
                          setCurrentJob(job);
                          if (job.status === 'processing') {
                            setProgressMessage('Regenerating with DALL-E 3...');
                          }
                        });
                        setGeneratedImage(imageData.imageUrl);
                      } catch (error) {
                        console.error('Error regenerating image:', error);
                        alert('Failed to regenerate image.');
                      } finally {
                        setIsLoading(false);
                        setProgressMessage('');
                        setCurrentJob(null);
                      }
                    }}
                    disabled={isLoading}
                    className="flex-1 bg-secondary text-secondary-foreground py-3 rounded-md font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Regenerating...' : 'Regenerate'}
                  </button>
                  <button
                    onClick={handleGenerateVideo}
                    disabled={isLoading}
                    className="flex-1 bg-primary text-primary-foreground py-3 rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                    ) : (
                      <>Generate Video <Video className="w-4 h-4" /></>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'video' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-card p-8 rounded-lg shadow-lg text-center"
            >
              <Video className="w-16 h-16 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-semibold mb-4">Video Generation in Progress</h2>
              <p className="text-muted-foreground mb-6">
                Your video is being generated with Runway ML. This may take a few minutes...
              </p>
              <div className="flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}