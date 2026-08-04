import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, Square, Loader2, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { transcribeBrief } from "@/lib/quote-copilot.functions";

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read that image."));
    r.readAsDataURL(file);
  });

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Could not read the recording."));
    r.readAsDataURL(blob);
  });

/**
 * Shared dictation + photo capture used by every Quote Assist surface
 * (dashboard widget, Calls Log copilot, Quotes page draft dialog).
 */
export function BriefCapture({
  brief,
  onBriefChange,
  images,
  onImagesChange,
  label = "Extra detail (dictate or type)",
  placeholder = "Tap the mic and talk it through — e.g. 'Basin mixer tap replacement, isolation valves seized…'",
  rows = 4,
  disabled,
}: {
  brief: string;
  onBriefChange: (v: string) => void;
  images: string[];
  onImagesChange: (v: string[]) => void;
  label?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}) {
  const transcribeFn = useServerFn(transcribeBrief);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 2048) {
          toast.error("That recording was empty — try again.");
          return;
        }
        setTranscribing(true);
        try {
          const base64 = await blobToBase64(blob);
          const { text } = await transcribeFn({ data: { audioBase64: base64, mimeType: mime } });
          if (text) onBriefChange(brief ? `${brief} ${text}` : text);
          else toast.error("Couldn't hear anything — try again.");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Transcription failed.");
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      toast.error("Microphone access is needed to dictate.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const picked = Array.from(files).slice(0, 6 - images.length);
    try {
      const urls = await Promise.all(picked.map(fileToDataUrl));
      onImagesChange([...images, ...urls].slice(0, 6));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add that photo.");
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <Textarea
        rows={rows}
        value={brief}
        onChange={(e) => onBriefChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={recording ? "destructive" : "outline"}
          className="gap-1"
          onClick={recording ? stopRecording : startRecording}
          disabled={disabled || transcribing}
        >
          {recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          {recording ? "Stop" : "Dictate"}
        </Button>
        <label>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={disabled}
            onChange={(e) => addPhotos(e.target.files)}
          />
          <span className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-input px-3 text-xs font-medium hover:bg-accent">
            <ImagePlus className="h-3.5 w-3.5" /> Photos
          </span>
        </label>
        {transcribing && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Transcribing…
          </span>
        )}
        {recording && <Badge variant="destructive" className="animate-pulse">Recording</Badge>}
      </div>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {images.map((src, i) => (
            <div key={i} className="relative">
              <img src={src} alt={`Job photo ${i + 1}`} className="h-16 w-16 rounded-md object-cover" />
              <button
                type="button"
                onClick={() => onImagesChange(images.filter((_, idx) => idx !== i))}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 shadow"
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
