import { useEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import Spinner from './Spinner';

// Loads an image that needs the auth header (an <img src> cannot send it).
// `load` returns a Blob. `cacheKey` decides when to reload.
export default function AuthImage({ cacheKey, load, alt, className }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let url = null;
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    loadRef
      .current()
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [cacheKey]);

  if (failed) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <ImageOff className="size-4" /> Screenshot unavailable
      </p>
    );
  }
  if (!src) return <Spinner className="size-4 text-brand" />;
  return (
    <a href={src} target="_blank" rel="noreferrer" title="Open full size">
      <img src={src} alt={alt} className={className} />
    </a>
  );
}