import { useEffect, useState } from 'react';
import { CloseIcon, DownloadIcon } from './icons';
import { IconButton } from './ui/IconButton';

interface Props {
  url: string;
  fileName: string;
  fileType: 'image' | 'video' | 'pdf' | 'text' | 'office' | 'audio' | 'unknown';
  onClose: () => void;
}

function detectType(fileName: string, msgType?: string): Props['fileType'] {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (msgType === 'image' || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
  if (msgType === 'video' || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  if (['txt', 'md', 'log', 'json', 'xml', 'yml', 'yaml', 'csv', 'ts', 'js', 'py', 'go', 'java', 'c', 'cpp', 'sh', 'sql', 'css', 'html'].includes(ext)) return 'text';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'office';
  return 'unknown';
}

function TextViewer({ url }: { url: string }) {
  const [content, setContent] = useState<string>('加载中…');
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => setContent(t.length > 50000 ? t.slice(0, 50000) + '\n\n…（内容过长，仅显示前 50KB）' : t))
      .catch(() => setError(true));
  }, [url]);
  if (error) return <p style={{ color: 'var(--text-muted)' }}>无法加载文本内容</p>;
  return (
    <pre style={{
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      maxHeight: '70vh',
      overflowY: 'auto',
      color: 'var(--text-primary)',
      fontSize: 13,
      lineHeight: 1.6,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      margin: 0,
    }}>{content}</pre>
  );
}

/**
 * 文件预览弹层：图片放大 / 视频播放 / PDF 内嵌 / 文本直读 / Office 在线预览。
 */
export default function FilePreview({ url, fileName, fileType: ftProp, onClose }: Props) {
  const ft = ftProp === 'unknown' ? detectType(fileName) : ftProp;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const absUrl = url.startsWith('http') ? url : window.location.origin + url;

  return (
    <div
      className="fixed inset-0 z-[95] flex flex-col"
      style={{ background: 'rgba(8, 10, 14, 0.92)', cursor: 'default' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* 工具栏 */}
      <div className="flex items-center justify-between" style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <span className="truncate text-sm font-medium" style={{ color: '#fff', maxWidth: '60%' }}>{fileName}</span>
        <div className="flex items-center gap-2">
          <a
            href={absUrl}
            download={fileName}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
          >
            <DownloadIcon size={14} />
            下载
          </a>
          <IconButton label="关闭" size="sm" onClick={onClose}>
            <CloseIcon size={16} />
          </IconButton>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex flex-1 items-center justify-center overflow-auto" style={{ padding: 16 }}>
        {ft === 'image' && (
          <img src={absUrl} alt={fileName} style={{ maxWidth: '90vw', maxHeight: '82vh', borderRadius: 8, objectFit: 'contain' }} />
        )}
        {ft === 'video' && (
          <video src={absUrl} controls autoPlay style={{ maxWidth: '90vw', maxHeight: '82vh', borderRadius: 8 }} />
        )}
        {ft === 'audio' && (
          <audio src={absUrl} controls autoPlay style={{ width: '80%' }} />
        )}
        {ft === 'pdf' && (
          <iframe src={absUrl} title={fileName} style={{ width: '85vw', height: '82vh', border: 'none', borderRadius: 8, background: '#fff' }} />
        )}
        {ft === 'text' && (
          <div style={{ width: '80vw', maxHeight: '82vh', background: 'var(--bg-secondary)', borderRadius: 8, padding: 20, overflow: 'hidden' }}>
            <TextViewer url={absUrl} />
          </div>
        )}
        {ft === 'office' && (
          <iframe
            src={`https://view.officeapps.live.com/embed.aspx?src=${encodeURIComponent(absUrl)}`}
            title={fileName}
            style={{ width: '85vw', height: '82vh', border: 'none', borderRadius: 8, background: '#fff' }}
          />
        )}
        {ft === 'unknown' && (
          <div className="text-center">
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>此文件格式暂不支持在线预览</p>
            <a href={absUrl} download={fileName} className="rounded-lg px-4 py-2 text-sm" style={{ background: 'var(--accent)', color: '#fff' }}>
              下载文件
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export { detectType };
