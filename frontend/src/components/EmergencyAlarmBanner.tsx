import React, { useEffect, useRef, useState } from 'react';
import { AlertOctagon, Volume2, VolumeX, BellRing, ArrowRight } from 'lucide-react';
import { Incident } from '../types';

interface EmergencyAlarmBannerProps {
  activeIncidents: Incident[];
  onViewIncident: (incident: Incident) => void;
}

export const EmergencyAlarmBanner: React.FC<EmergencyAlarmBannerProps> = ({
  activeIncidents,
  onViewIncident,
}) => {
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isTestPlaying, setIsTestPlaying] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<number | null>(null);

  const topIncident = activeIncidents[0] || null;
  const shouldAlarmSound = Boolean(topIncident) && !isMuted;

  // Initialize Web Audio API Siren Generator
  const startSirenAudio = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtxClass) return;
        audioCtxRef.current = new AudioCtxClass();
      }

      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      if (oscillatorRef.current) {
        return; // Already playing
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(700, ctx.currentTime);

      gain.gain.setValueAtTime(0.12, ctx.currentTime); // Safe, audible volume
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();

      oscillatorRef.current = osc;
      gainNodeRef.current = gain;

      // Oscillate frequency between 650Hz and 950Hz to create an authentic emergency siren
      let high = false;
      intervalRef.current = window.setInterval(() => {
        if (!oscillatorRef.current || !audioCtxRef.current) return;
        const now = audioCtxRef.current.currentTime;
        const targetFreq = high ? 650 : 950;
        oscillatorRef.current.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.35);
        high = !high;
      }, 400);
    } catch (err) {
      console.warn('Audio alarm playback notice:', err);
    }
  };

  const stopSirenAudio = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      } catch (e) {
        // quiet cleanup
      }
      oscillatorRef.current = null;
    }
    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
      } catch (e) {
        // quiet cleanup
      }
      gainNodeRef.current = null;
    }
  };

  // Sync siren playback with active incidents and mute state
  useEffect(() => {
    if (shouldAlarmSound || isTestPlaying) {
      startSirenAudio();
    } else {
      stopSirenAudio();
    }

    return () => {
      stopSirenAudio();
    };
  }, [shouldAlarmSound, isTestPlaying]);

  const handleToggleTest = () => {
    if (isTestPlaying) {
      setIsTestPlaying(false);
    } else {
      setIsTestPlaying(true);
      // Auto-stop test after 4 seconds
      setTimeout(() => {
        setIsTestPlaying(false);
      }, 4000);
    }
  };

  if (!topIncident && !isTestPlaying) {
    return null;
  }

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white p-4 shadow-xl border-2 border-red-500 animate-pulse transition-all">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Alarm Status */}
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
            <AlertOctagon className="w-6 h-6 text-white animate-bounce" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-white text-red-700 shadow-xs">
                🚨 {isTestPlaying ? 'ALARM TEST RUNNING' : 'P1 EMERGENCY SOS ALARM'}
              </span>
              <span className="text-xs font-semibold text-red-100 uppercase tracking-wider">
                Status: {topIncident ? topIncident.status : 'SIMULATED'}
              </span>
            </div>
            <p className="text-sm font-bold text-white mt-0.5 line-clamp-1">
              {topIncident
                ? `CRITICAL OUTAGE: Service '${topIncident.failed_service}' failed! Downstream systems degraded.`
                : 'Audible emergency siren test active in browser & mobile channels.'}
            </p>
          </div>
        </div>

        {/* Right: Audio Controls & Action Button */}
        <div className="flex items-center space-x-2.5 self-end md:self-center shrink-0">
          {/* Mute / Unmute Button */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer border ${
              isMuted
                ? 'bg-red-800/80 border-red-400 text-red-100 hover:bg-red-700'
                : 'bg-white/20 border-white/40 text-white hover:bg-white/30'
            }`}
            title={isMuted ? 'Unmute siren sound' : 'Mute siren sound'}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-4 h-4 text-red-200" />
                <span>Unmute Siren</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-white animate-pulse" />
                <span>Mute Siren</span>
              </>
            )}
          </button>

          {/* Test Sound Button */}
          <button
            onClick={handleToggleTest}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-black/20 hover:bg-black/30 border border-white/20 text-white flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>{isTestPlaying ? 'Stop Test' : 'Test Siren'}</span>
          </button>

          {/* View Incident Button */}
          {topIncident && (
            <button
              onClick={() => onViewIncident(topIncident)}
              className="px-4 py-1.5 rounded-lg text-xs font-black bg-white text-red-700 hover:bg-red-50 shadow-md flex items-center space-x-1.5 transition-transform active:scale-95 cursor-pointer"
            >
              <span>View & Recover</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

