import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getModelWeights, predictModel, type ModelPrediction, type ModelWeight } from '../api/model';
import './model-showcase.css';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('无法读取结果图片'));
    image.src = src;
  });
}

function download(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export default function ModelShowcase() {
  const [weights, setWeights] = useState<ModelWeight[]>([]);
  const [modelId, setModelId] = useState('CrackMap');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [prediction, setPrediction] = useState<ModelPrediction | null>(null);
  const [threshold, setThreshold] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    getModelWeights().then((items) => {
      setWeights(items);
      setModelId((current) => items.some((item) => item.id === current) ? current : (items[0]?.id || current));
    }).catch(() => setError('无法加载权重列表，请检查 Go 服务'));
  }, []);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  useEffect(() => {
    if (!prediction || !previewUrl) return;
    let cancelled = false;
    Promise.all([loadImage(previewUrl), loadImage(prediction.mask)]).then(([original, mask]) => {
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      canvas.width = prediction.width;
      canvas.height = prediction.height;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(original, 0, 0, canvas.width, canvas.height);
      const output = context.getImageData(0, 0, canvas.width, canvas.height);
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      const maskContext = maskCanvas.getContext('2d');
      if (!maskContext) return;
      maskContext.drawImage(mask, 0, 0, canvas.width, canvas.height);
      const maskPixels = maskContext.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let pixel = 0; pixel < output.data.length; pixel += 4) {
        if (maskPixels[pixel] < Math.round(threshold * 255)) continue;
        output.data[pixel] = Math.round(output.data[pixel] * 0.35 + 255 * 0.65);
        output.data[pixel + 1] = Math.round(output.data[pixel + 1] * 0.35);
        output.data[pixel + 2] = Math.round(output.data[pixel + 2] * 0.35);
      }
      context.putImageData(output, 0, 0);
    }).catch((cause) => { if (!cancelled) setError(cause.message); });
    return () => { cancelled = true; };
  }, [prediction, previewUrl, threshold]);

  function chooseFile(chosen: File | undefined) {
    setError('');
    setPrediction(null);
    if (!chosen) { setFile(null); setPreviewUrl(''); return; }
    if (!['image/jpeg', 'image/png'].includes(chosen.type)) {
      setFile(null);
      setPreviewUrl('');
      setError('请选择 PNG 或 JPEG 图片');
      return;
    }
    if (chosen.size > MAX_FILE_BYTES) {
      setFile(null);
      setPreviewUrl('');
      setError('图片不能超过 5 MiB');
      return;
    }
    setFile(chosen);
    setPreviewUrl(URL.createObjectURL(chosen));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError('');
    setPrediction(null);
    try {
      setPrediction(await predictModel(modelId, file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '推理失败');
    } finally {
      setBusy(false);
    }
  }

  return <main className="model-page">
    <div className="model-page-inner">
      <header className="model-heading">
        <span className="model-eyebrow">SCSegamba · 图像分割演示</span>
        <h1>裂缝分割</h1>
        <p>选择训练数据集对应的权重，上传一张图片，查看像素级裂缝预测。</p>
      </header>

      <form className="model-controls" onSubmit={submit}>
        <label className="model-field">
          <span>模型权重</span>
          <select value={modelId} onChange={(event) => { setModelId(event.target.value); setPrediction(null); }} disabled={busy || !weights.length}>
            {weights.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="model-field model-file">
          <span>待检测图片</span>
          <input type="file" accept="image/png,image/jpeg" onChange={(event) => chooseFile(event.target.files?.[0])} disabled={busy} />
          <small>PNG / JPEG，最大 5 MiB</small>
        </label>
        <button className="model-submit" type="submit" disabled={!file || !weights.length || busy}>
          {busy ? '正在分析…' : '开始分割'}
        </button>
      </form>

      {error && <div className="model-error" role="alert">{error}</div>}

      <section className="model-results" aria-label="分割结果">
        <div className="model-result-card">
          <div className="model-result-head"><h2>原图</h2><span>{file?.name || '等待上传'}</span></div>
          <div className="model-image-frame">{previewUrl ? <img src={previewUrl} alt="上传的原图" /> : <p>选择图片后在这里预览</p>}</div>
        </div>
        <div className="model-result-card">
          <div className="model-result-head"><h2>概率图</h2>{prediction && <button type="button" onClick={() => download(prediction.mask, `${modelId}-probability.png`)}>下载</button>}</div>
          <div className="model-image-frame model-mask">{prediction ? <img src={prediction.mask} alt="裂缝概率灰度图" /> : <p>推理完成后显示</p>}</div>
        </div>
        <div className="model-result-card">
          <div className="model-result-head"><h2>叠加预览</h2>{prediction && <button type="button" onClick={() => { if (canvasRef.current) download(canvasRef.current.toDataURL('image/png'), `${modelId}-overlay.png`); }}>下载</button>}</div>
          <div className="model-image-frame">{prediction ? <canvas ref={canvasRef} aria-label="原图与裂缝预测叠加图" /> : <p>推理完成后显示</p>}</div>
        </div>
      </section>

      {prediction && <div className="model-result-footer">
        <label>分割阈值 <strong>{threshold.toFixed(2)}</strong><input type="range" min="0.05" max="0.95" step="0.05" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></label>
        <span>{prediction.width} × {prediction.height} · 推理 {Math.round(prediction.inference_ms)} ms</span>
      </div>}
      <p className="model-note">展示结果仅供模型效果演示；不同数据集权重可能对同一图片产生不同预测。</p>
    </div>
  </main>;
}
