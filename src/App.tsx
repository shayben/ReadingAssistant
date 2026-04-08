import { useState } from 'react';
import CameraCapture from './components/CameraCapture';
import OcrPreview from './components/OcrPreview';
import ReadingSession from './components/ReadingSession';

type AppStep = 'capture' | 'ocr-preview' | 'reading';

export default function App() {
  const [step, setStep] = useState<AppStep>('capture');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [assignmentText, setAssignmentText] = useState<string>('');

  const handleCapture = (dataUrl: string) => {
    setCapturedImage(dataUrl);
    setStep('ocr-preview');
  };

  const handleTextConfirmed = (text: string) => {
    setAssignmentText(text);
    setStep('reading');
  };

  const handleReset = () => {
    setCapturedImage(null);
    setAssignmentText('');
    setStep('capture');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      {/* Header */}
      <header className="bg-indigo-600 text-white px-4 py-3 shadow-md">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <span className="text-2xl">📖</span>
          <h1 className="text-xl font-bold tracking-tight">Reading Assistant</h1>
        </div>
      </header>

      {/* Step indicator */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
          <span className={step === 'capture' ? 'text-indigo-600 font-semibold' : ''}>1. Capture</span>
          <span>›</span>
          <span className={step === 'ocr-preview' ? 'text-indigo-600 font-semibold' : ''}>2. Review</span>
          <span>›</span>
          <span className={step === 'reading' ? 'text-indigo-600 font-semibold' : ''}>3. Read</span>
        </div>
      </div>

      {/* Main content */}
      <main className="pb-8">
        {step === 'capture' && (
          <CameraCapture onCapture={handleCapture} />
        )}

        {step === 'ocr-preview' && capturedImage && (
          <OcrPreview
            imageDataUrl={capturedImage}
            onTextConfirmed={handleTextConfirmed}
            onRetake={handleReset}
          />
        )}

        {step === 'reading' && assignmentText && (
          <ReadingSession text={assignmentText} onReset={handleReset} />
        )}
      </main>
    </div>
  );
}
