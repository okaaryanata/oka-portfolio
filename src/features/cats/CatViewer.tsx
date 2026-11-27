import { useCatGif } from './useCatGif';
export function CatViewer() {
  const cat = useCatGif();
  return (
    <div id="cats-app">
      <div className="cat-viewer">
        <img src={cat.src} alt={cat.playing ? 'Random cat GIF' : 'Pixel-art cat preview'} />
      </div>
      <div className="controls">
        <button className="button primary" disabled={cat.busy} onClick={() => void cat.load()}>
          Load cat GIF
        </button>
        <button className="button" disabled={cat.busy} onClick={() => void cat.load()}>
          Another cat
        </button>
        <button className="button" onClick={cat.stop}>
          Stop animation
        </button>
      </div>
      <p className="result" role="status">
        {cat.status || 'Ready to load a cat GIF.'}
      </p>
    </div>
  );
}
