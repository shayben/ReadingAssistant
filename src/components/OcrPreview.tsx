import React, { useState, useEffect } from 'react';
import { recognizeText } from '../services/ocrService';

interface OcrPreviewProps {
  imageDataUrl: string;
  onTextConfirmed: (text: string) => void;
  onRetake: () => void;
}

const OcrPreview: React.FC<OcrPreviewProps> = ({ imageDataUrl, onTextConfirmed, onRetake }) => {
  const [loading, setLoading] = useState(true);
  const [ocrText, setOcrText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    recognizeText(imageDataUrl)
      .then((result) => {
        if (!cancelled) {
          setOcrText(result.text);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [imageDataUrl]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-lg mx-auto p-4">
      <h2 className="text-2xl font-bold text-indigo-700 text-center">
        🔍 Review Captured Text
      </h2>

      {/* Captured image thumbnail */}
      <img
        src={imageDataUrl}
        alt="Captured"
        className="w-full rounded-2xl shadow-md object-contain max-h-48"
      />

      {loading && (
        <div className="flex flex-col items-center gap-2 py-6">
          <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Reading text from image…</p>
        </div>
      )}

      {error && (
        <div className="w-full bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-600 text-sm font-medium">OCR Error</p>
          <p className="text-red-500 text-sm mt-1">{error}</p>
          <p className="text-gray-500 text-xs mt-2">
            You can type the text manually below.
          </p>
        </div>
      )}

      {!loading && (
        <>
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recognised text (edit if needed):
            </label>
            <textarea
              value={ocrText}
              onChange={(e) => setOcrText(e.target.value)}
              rows={6}
              className="w-full rounded-xl border-2 border-gray-200 p-3 text-gray-800
                         focus:border-indigo-400 focus:outline-none resize-none text-base"
              placeholder="No text detected. Type or paste the reading assignment here…"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              type="button"
              onClick={() => ocrText.trim() && onTextConfirmed(ocrText.trim())}
              disabled={!ocrText.trim()}
              className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-lg
                         disabled:opacity-40 active:bg-indigo-700 transition-colors shadow"
            >
              ✅ Start Reading
            </button>
            <button
              type="button"
              onClick={onRetake}
              className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-700 font-semibold text-lg
                         active:bg-gray-300 transition-colors"
            >
              🔄 Retake
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default OcrPreview;
