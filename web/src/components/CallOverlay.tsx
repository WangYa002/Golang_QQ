import { useEffect, useMemo, useRef } from 'react';
import { useCallStore } from '../store/call';
import { PhoneIcon, HangupIcon, MicOffIcon, VideoOffIcon, CloseIcon } from './icons';

const AVATAR_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];
function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function VideoBox({ stream, muted, mirror }: { stream: MediaStream | null; muted?: boolean; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);
  if (!stream) return null;
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className="w-full h-full object-cover"
      style={mirror ? { transform: 'scaleX(-1)' } : undefined}
    />
  );
}

const END_REASON_TEXT: Record<string, string> = {
  rejected: '对方拒绝了通话',
  busy: '对方忙线中',
  canceled: '通话已取消',
  ended: '通话已结束',
  timeout: '对方无人接听',
  hangup: '通话已结束',
  failed: '无法访问音视频设备',
};

export default function CallOverlay() {
  const status = useCallStore((s) => s.status);
  const callType = useCallStore((s) => s.callType);
  const peerName = useCallStore((s) => s.peerName);
  const endedReason = useCallStore((s) => s.endedReason);
  const isMuted = useCallStore((s) => s.isMuted);
  const isCameraOff = useCallStore((s) => s.isCameraOff);
  const elapsed = useCallStore((s) => s.elapsed);
  const localStream = useCallStore((s) => s.localStream);
  const remoteStream = useCallStore((s) => s.remoteStream);

  const accept = useCallStore((s) => s.acceptCall);
  const reject = useCallStore((s) => s.rejectCall);
  const cancel = useCallStore((s) => s.cancelCall);
  const hangup = useCallStore((s) => s.hangup);
  const toggleMute = useCallStore((s) => s.toggleMute);
  const toggleCamera = useCallStore((s) => s.toggleCamera);
  const reset = useCallStore((s) => s.reset);

  const avatarColor = useMemo(() => getAvatarColor(peerName || '?'), [peerName]);

  // 结束态展示 2.5s 后自动关闭
  useEffect(() => {
    if (status !== 'ended') return;
    const t = setTimeout(() => reset(), 2500);
    return () => clearTimeout(t);
  }, [status, reset]);

  if (status === 'idle') return null;

  const isVideo = callType === 'video';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(5,8,16,0.92)', backdropFilter: 'blur(8px)' }}>

      {/* 视频通话时的大画面背景 */}
      {status === 'active' && isVideo && (
        <div className="absolute inset-0">
          {remoteStream ? (
            <VideoBox stream={remoteStream} />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
              <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor + 'aa'})` }}>
                {peerName?.[0]?.toUpperCase()}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center px-8"
        style={{ maxWidth: 420, width: '100%' }}>
        {/* 头像 */}
        {(status === 'calling' || status === 'incoming' || (status === 'active' && !isVideo) || status === 'ended') && (
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold text-white mb-6"
            style={{
              background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor + 'aa'})`,
              boxShadow: `0 0 40px ${avatarColor}44`,
              animation: status === 'incoming' ? 'pulse 1.2s infinite' : undefined,
            }}>
            {peerName?.[0]?.toUpperCase()}
          </div>
        )}

        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          {peerName}
        </h2>

        <p className="text-sm mb-10" style={{ color: 'var(--text-secondary)' }}>
          {status === 'calling' && '正在呼叫...'}
          {status === 'incoming' && (isVideo ? '邀请你进行视频通话' : '邀请你进行语音通话')}
          {status === 'active' && (
            <span style={{ color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
              通话中 {fmt(elapsed)}
            </span>
          )}
          {status === 'ended' && (END_REASON_TEXT[endedReason || 'ended'] || '通话已结束')}
        </p>

        {/* 视频通话：本地预览 + 远端 */}
        {status === 'active' && isVideo && (
          <div className="w-full mb-10">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden"
              style={{ background: '#000', border: '1px solid var(--border)' }}>
              {!remoteStream && (
                <div className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  等待对方视频...
                </div>
              )}
              <VideoBox stream={remoteStream} />
              <div className="absolute bottom-3 right-3 w-32 aspect-video rounded-lg overflow-hidden"
                style={{ border: '1px solid rgba(255,255,255,0.3)' }}>
                {localStream ? <VideoBox stream={localStream} muted mirror /> : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-white"
                    style={{ background: 'var(--bg-tertiary)' }}>
                    无画面
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-5">
          {status === 'calling' && (
            <button
              onClick={cancel}
              className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer border-none"
              style={{ background: 'rgba(148,163,184,0.15)', color: '#fff' }}
              title="取消"
            >
              <CloseIcon size={24} />
            </button>
          )}

          {status === 'incoming' && (
            <>
              <button
                onClick={reject}
                className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer border-none"
                style={{ background: 'rgba(239,68,68,0.85)', color: '#fff' }}
                title="拒绝"
              >
                <HangupIcon size={26} />
              </button>
              <button
                onClick={accept}
                className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer border-none"
                style={{ background: 'var(--success)', color: '#fff' }}
                title="接听"
              >
                <PhoneIcon size={26} />
              </button>
            </>
          )}

          {status === 'active' && (
            <>
              {isVideo && (
                <button
                  onClick={toggleCamera}
                  className="w-12 h-12 rounded-full flex items-center justify-center cursor-pointer border-none"
                  style={{ background: isCameraOff ? 'rgba(239,68,68,0.7)' : 'rgba(148,163,184,0.18)', color: '#fff' }}
                  title={isCameraOff ? '打开摄像头' : '关闭摄像头'}
                >
                  <VideoOffIcon size={20} />
                </button>
              )}
              <button
                onClick={toggleMute}
                className="w-12 h-12 rounded-full flex items-center justify-center cursor-pointer border-none"
                style={{ background: isMuted ? 'rgba(239,68,68,0.7)' : 'rgba(148,163,184,0.18)', color: '#fff' }}
                title={isMuted ? '取消静音' : '静音'}
              >
                <MicOffIcon size={20} />
              </button>
              <button
                onClick={hangup}
                className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer border-none"
                style={{ background: '#ef4444', color: '#fff', boxShadow: '0 4px 20px rgba(239,68,68,0.4)' }}
                title="挂断"
              >
                <HangupIcon size={26} />
              </button>
            </>
          )}

          {status === 'ended' && (
            <button
              onClick={reset}
              className="px-8 py-3 rounded-full text-sm font-medium cursor-pointer border-none"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            >
              知道了
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
