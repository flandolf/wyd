import { useState, useEffect, useRef } from 'react'
import { X, Play, Pause, Volume2, VolumeX, Music, Wind, CloudRain, Coffee } from 'lucide-react'
import { SubjectData } from './SubjectItem'
import { Button } from './ui/button'
import { Slider } from './ui/slider'
import { cn } from '../lib/utils'

interface FocusOverlayProps {
  subject: SubjectData
  onClose: () => void
  onToggle: () => void
}

const SOUNDS = [
  { id: 'rain', name: 'Rain', icon: CloudRain, url: 'https://www.soundjay.com/nature/rain-01.mp3' },
  { id: 'wind', name: 'Wind', icon: Wind, url: 'https://www.soundjay.com/nature/wind-01.mp3' },
  { id: 'lofi', name: 'Lo-Fi', icon: Music, url: 'https://www.soundjay.com/misc/sounds/bell-ringing-01.mp3' }, // Placeholder
  { id: 'cafe', name: 'Cafe', icon: Coffee, url: 'https://www.soundjay.com/misc/sounds/canteen-ambience-1.mp3' },
]

export function FocusOverlay({ subject, onClose, onToggle }: FocusOverlayProps) {
  const [displayTime, setDisplayTime] = useState(subject.accumulatedTime)
  const [activeSound, setActiveSound] = useState<string | null>(null)
  const [volume, setVolume] = useState(0.5)
  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    let animationFrameId: number
    const updateTime = () => {
      if (subject.isRunning && subject.startTime !== null) {
        const elapsed = subject.accumulatedTime + (Date.now() - subject.startTime)
        setDisplayTime(elapsed)
        animationFrameId = requestAnimationFrame(updateTime)
      } else {
        setDisplayTime(subject.accumulatedTime)
      }
    }
    updateTime()
    return () => cancelAnimationFrame(animationFrameId)
  }, [subject.isRunning, subject.startTime, subject.accumulatedTime])

  useEffect(() => {
    if (activeSound) {
      const sound = SOUNDS.find(s => s.id === activeSound)
      if (sound) {
        if (audioRef.current) audioRef.current.pause()
        audioRef.current = new Audio(sound.url)
        audioRef.current.loop = true
        audioRef.current.volume = isMuted ? 0 : volume
        audioRef.current.play().catch(e => console.error("Audio play failed", e))
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
    return () => {
      if (audioRef.current) audioRef.current.pause()
    }
  }, [activeSound])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  const formatMs = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours > 0 ? hours + ':' : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center animate-in fade-in duration-700">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-8 right-8 text-white/40 hover:text-white hover:bg-white/10 h-12 w-12 rounded-full"
        onClick={onClose}
      >
        <X className="w-8 h-8" />
      </Button>

      <div className="text-center space-y-12 max-w-2xl w-full px-8">
        <div className="space-y-4">
          <span className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest border border-primary/20">
            {subject.category || 'Focus Session'}
          </span>
          <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight">{subject.title}</h2>
        </div>

        <div className="text-[120px] md:text-[180px] font-black text-white tabular-nums tracking-tighter leading-none">
          {formatMs(displayTime)}
        </div>

        <div className="flex flex-col items-center gap-12">
          <Button
            size="lg"
            className={cn(
              "w-24 h-24 rounded-full transition-transform active:scale-90 shadow-2xl shadow-primary/20",
              subject.isRunning ? "bg-orange-500 hover:bg-orange-600" : "bg-primary hover:bg-primary/90"
            )}
            onClick={onToggle}
          >
            {subject.isRunning ? (
              <Pause className="w-10 h-10 fill-current" />
            ) : (
              <Play className="w-10 h-10 fill-current ml-2" />
            )}
          </Button>

          <div className="w-full space-y-8 bg-white/5 p-8 rounded-3xl border border-white/10">
            <div className="flex items-center justify-center gap-6">
              {SOUNDS.map((sound) => (
                <button
                  key={sound.id}
                  onClick={() => setActiveSound(activeSound === sound.id ? null : sound.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 transition-all",
                    activeSound === sound.id ? "text-primary scale-110" : "text-white/40 hover:text-white"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center border transition-all",
                    activeSound === sound.id ? "bg-primary/20 border-primary" : "bg-white/5 border-white/10"
                  )}>
                    <sound.icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">{sound.name}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 px-8">
              <button onClick={() => setIsMuted(!isMuted)}>
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-white/40" /> : <Volume2 className="w-5 h-5 text-white/40" />}
              </button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.01}
                onValueChange={([v]) => {
                  setVolume(v)
                  setIsMuted(false)
                }}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-12 text-white/20 text-xs font-medium tracking-[0.2em] uppercase">
        Deep Work in Progress
      </div>
    </div>
  )
}
