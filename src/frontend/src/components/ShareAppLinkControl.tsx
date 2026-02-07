import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Share2, Check, Copy } from 'lucide-react';
import { getShareUrl } from '../utils/getShareUrl';

export default function ShareAppLinkControl() {
  const [copied, setCopied] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const shareUrl = getShareUrl();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setShowFallback(false);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Clipboard API failed, show fallback
      setShowFallback(true);
    }
  };

  const handleFallbackCopy = () => {
    const input = document.getElementById('share-url-fallback') as HTMLInputElement;
    if (input) {
      input.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Fallback copy failed:', error);
      }
    }
  };

  if (showFallback) {
    return (
      <div className="flex items-center gap-2">
        <Input
          id="share-url-fallback"
          type="text"
          value={shareUrl}
          readOnly
          className="h-9 text-xs"
        />
        <Button
          onClick={handleFallbackCopy}
          size="sm"
          variant="outline"
          className="gap-2"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={handleCopy}
      size="sm"
      variant="outline"
      className="gap-2"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          Copied
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          Copy app link
        </>
      )}
    </Button>
  );
}
