import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Video, Camera, AlertCircle, CheckCircle, 
  Loader2, Eye, RotateCcw, Play, Square
} from "lucide-react";

interface LivenessChallenge {
  id: string;
  instruction: string;
  type: 'blink' | 'turn_left' | 'turn_right' | 'nod' | 'smile';
  completed: boolean;
}

interface LivenessResult {
  passed: boolean;
  score: number;
  challenges: LivenessChallenge[];
  videoBlob?: Blob;
}

interface LivenessDetectionProps {
  onComplete: (result: LivenessResult, videoUrl: string) => void;
  onCancel?: () => void;
}

const CHALLENGES: Omit<LivenessChallenge, 'completed'>[] = [
  { id: 'blink', instruction: 'Моргните 3 раза', type: 'blink' },
  { id: 'turn_left', instruction: 'Поверните голову влево', type: 'turn_left' },
  { id: 'turn_right', instruction: 'Поверните голову вправо', type: 'turn_right' },
  { id: 'nod', instruction: 'Кивните головой', type: 'nod' },
];

export const LivenessDetection = ({ onComplete, onCancel }: LivenessDetectionProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [challenges, setChallenges] = useState<LivenessChallenge[]>(
    CHALLENGES.map(c => ({ ...c, completed: false }))
  );
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [timer, setTimer] = useState(0);
  const [status, setStatus] = useState<'idle' | 'preparing' | 'recording' | 'processing' | 'complete' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);

  // Auto-advance challenges based on time (simplified - real implementation would use face detection)
  useEffect(() => {
    if (status !== 'recording') return;

    const interval = setInterval(() => {
      setTimer(prev => {
        const newTime = prev + 1;
        
        // Auto-advance challenge every 3 seconds (simulated detection)
        const challengeIndex = Math.min(Math.floor(newTime / 3), challenges.length - 1);
        
        if (challengeIndex > currentChallengeIndex) {
          setChallenges(prev => prev.map((c, i) => 
            i < challengeIndex ? { ...c, completed: true } : c
          ));
          setCurrentChallengeIndex(challengeIndex);
        }
        
        // Complete all challenges after 12 seconds
        if (newTime >= 12) {
          setChallenges(prev => prev.map(c => ({ ...c, completed: true })));
          stopRecording();
        }
        
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status, currentChallengeIndex, challenges.length]);

  const startCamera = async () => {
    try {
      setStatus('preparing');
      setError(null);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      // Countdown before recording
      setCountdown(3);
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            startRecording(mediaStream);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (err) {
      console.error('Camera error:', err);
      setError('Не удалось получить доступ к камере');
      setStatus('error');
    }
  };

  const startRecording = (mediaStream: MediaStream) => {
    try {
      chunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: 'video/webm;codecs=vp9'
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        processRecording();
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsRecording(true);
      setStatus('recording');
      setTimer(0);
      setCurrentChallengeIndex(0);
      setChallenges(CHALLENGES.map(c => ({ ...c, completed: false })));
      
    } catch (err) {
      console.error('Recording error:', err);
      setError('Не удалось начать запись');
      setStatus('error');
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatus('processing');
    }
  }, [isRecording]);

  const processRecording = async () => {
    try {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const videoUrl = URL.createObjectURL(blob);
      
      // Calculate liveness score based on completed challenges
      const completedCount = challenges.filter(c => c.completed).length;
      const score = (completedCount / challenges.length) * 100;
      const passed = score >= 75;
      
      const result: LivenessResult = {
        passed,
        score,
        challenges,
        videoBlob: blob
      };
      
      setStatus('complete');
      onComplete(result, videoUrl);
      
    } catch (err) {
      console.error('Processing error:', err);
      setError('Ошибка обработки видео');
      setStatus('error');
    }
  };

  const reset = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setIsRecording(false);
    setStatus('idle');
    setChallenges(CHALLENGES.map(c => ({ ...c, completed: false })));
    setCurrentChallengeIndex(0);
    setTimer(0);
    setError(null);
  };

  const completedCount = challenges.filter(c => c.completed).length;
  const progress = (completedCount / challenges.length) * 100;

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="w-5 h-5" />
          Проверка живости
        </CardTitle>
        <CardDescription>
          Выполните простые действия перед камерой для подтверждения личности
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Video preview */}
        <div className="relative aspect-video bg-muted rounded-xl overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
            style={{ transform: 'scaleX(-1)' }}
          />
          
          {/* Countdown overlay */}
          {status === 'preparing' && countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="text-6xl font-bold text-white animate-pulse">
                {countdown}
              </span>
            </div>
          )}
          
          {/* Recording indicator */}
          {status === 'recording' && (
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-white bg-black/50 px-2 py-1 rounded">
                REC {timer}s
              </span>
            </div>
          )}
          
          {/* Idle state */}
          {status === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
              <Camera className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Нажмите кнопку для начала</p>
            </div>
          )}
          
          {/* Processing */}
          {status === 'processing' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
              <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
              <p className="text-white">Анализ видео...</p>
            </div>
          )}
          
          {/* Complete */}
          {status === 'complete' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-500/20">
              <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
              <p className="text-green-700 font-medium">Проверка завершена!</p>
            </div>
          )}
        </div>
        
        {/* Current challenge */}
        {status === 'recording' && (
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-3">
              <Eye className="w-6 h-6 text-primary animate-pulse" />
              <div>
                <p className="font-medium text-lg">
                  {challenges[currentChallengeIndex]?.instruction}
                </p>
                <p className="text-sm text-muted-foreground">
                  Шаг {currentChallengeIndex + 1} из {challenges.length}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Progress */}
        {status === 'recording' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Прогресс</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
        
        {/* Challenges list */}
        {(status === 'recording' || status === 'complete') && (
          <div className="space-y-2">
            {challenges.map((challenge, index) => (
              <div 
                key={challenge.id}
                className={`flex items-center gap-3 p-2 rounded-lg ${
                  challenge.completed 
                    ? 'bg-green-50 text-green-700' 
                    : index === currentChallengeIndex 
                      ? 'bg-primary/10 text-primary' 
                      : 'bg-muted/50 text-muted-foreground'
                }`}
              >
                {challenge.completed ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <span className="w-4 h-4 rounded-full border-2 border-current" />
                )}
                <span className="text-sm">{challenge.instruction}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-2">
          {status === 'idle' && (
            <>
              <Button onClick={startCamera} className="flex-1">
                <Play className="w-4 h-4 mr-2" />
                Начать проверку
              </Button>
              {onCancel && (
                <Button variant="outline" onClick={onCancel}>
                  Отмена
                </Button>
              )}
            </>
          )}
          
          {status === 'recording' && (
            <Button variant="destructive" onClick={stopRecording} className="flex-1">
              <Square className="w-4 h-4 mr-2" />
              Остановить
            </Button>
          )}
          
          {(status === 'complete' || status === 'error') && (
            <Button variant="outline" onClick={reset} className="flex-1">
              <RotateCcw className="w-4 h-4 mr-2" />
              Повторить
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
