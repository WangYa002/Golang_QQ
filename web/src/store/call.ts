import { create } from 'zustand';

export type CallType = 'voice' | 'video';
export type CallStatus = 'idle' | 'calling' | 'incoming' | 'active' | 'ended';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface CallState {
  status: CallStatus;
  callType: CallType | null;
  callId: string | null;
  conversationId: string | null;
  peerName: string | null;
  peerId: string | null;
  endedReason: string | null; // rejected | busy | canceled | ended | timeout | failed
  isMuted: boolean;
  isCameraOff: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  elapsed: number;

  setSend: (fn: (type: string, data: unknown) => void) => void;
  startCall: (conversationId: string, callType: CallType, peerName: string, peerId: string) => void;
  cancelCall: () => void;
  acceptCall: () => void;
  rejectCall: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  handleWSEvent: (msg: { type: string; data?: unknown }) => void;
  reset: () => void;
}

// 非响应式内部状态（WebRTC 连接、WS 发送函数、定时器）
let pc: RTCPeerConnection | null = null;
let sendFn: ((type: string, data: unknown) => void) | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let pendingCandidates: RTCIceCandidateInit[] = [];
let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

function closePc() {
  if (pc) {
    try { pc.close(); } catch { /* ignore */ }
    pc = null;
  }
  pendingCandidates = [];
}

async function setupPeerConnection(
  set: (fn: Partial<CallState> | ((s: CallState) => Partial<CallState>)) => void,
  get: () => CallState,
  constraints: MediaStreamConstraints
) {
  closePc();
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch {
    set({ status: 'ended', endedReason: 'failed' });
    return null;
  }

  pc = new RTCPeerConnection(RTC_CONFIG);
  stream.getTracks().forEach((track) => pc!.addTrack(track, stream));

  const remote = new MediaStream();
  pc.ontrack = (e) => {
    e.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
    set({ remoteStream: remote });
  };
  pc.onicecandidate = (e) => {
    if (e.candidate && get().status === 'active') {
      sendFn?.('call_event', {
        conversation_id: get().conversationId,
        call_id: get().callId,
        kind: 'signal',
        signal: { type: 'ice', candidate: e.candidate.toJSON() },
      });
    }
  };
  pc.onconnectionstatechange = () => {
    if (pc && (pc.connectionState === 'failed' || pc.connectionState === 'disconnected')) {
      // 媒体通道失败不中断 UI 状态机，仅静默（本地开发环境常见）
    }
  };

  set({ localStream: stream, remoteStream: null });
  return pc;
}

function sendSignal(get: () => CallState, signal: unknown) {
  sendFn?.('call_event', {
    conversation_id: get().conversationId,
    call_id: get().callId,
    kind: 'signal',
    signal,
  });
}

function clearTimers() {
  if (timer) { clearInterval(timer); timer = null; }
  if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = null; }
}

export const useCallStore = create<CallState>((set, get) => ({
  status: 'idle',
  callType: null,
  callId: null,
  conversationId: null,
  peerName: null,
  peerId: null,
  endedReason: null,
  isMuted: false,
  isCameraOff: false,
  localStream: null,
  remoteStream: null,
  elapsed: 0,

  setSend: (fn) => { sendFn = fn; },

  startCall: (conversationId, callType, peerName, peerId) => {
    if (get().status !== 'idle') return;
    clearTimers();
    set({
      status: 'calling',
      callType,
      conversationId,
      callId: null,
      peerName,
      peerId,
      endedReason: null,
      isMuted: false,
      isCameraOff: false,
      localStream: null,
      remoteStream: null,
      elapsed: 0,
    });
    sendFn?.('call', { conversation_id: conversationId, call_type: callType });
    // 60s 无人接听自动挂断
    timeoutTimer = setTimeout(() => {
      if (get().status === 'calling') {
        sendFn?.('call_event', { conversation_id: conversationId, call_id: null, kind: 'hangup', reason: 'timeout' });
        closePc();
        stopStream(get().localStream);
        clearTimers();
        set({ status: 'ended', endedReason: 'timeout', localStream: null, remoteStream: null });
      }
    }, 60000);
  },

  cancelCall: () => {
    const s = get();
    if (s.status !== 'calling' && s.status !== 'incoming') return;
    sendFn?.('call_event', { conversation_id: s.conversationId, call_id: s.callId, kind: 'hangup', reason: 'canceled' });
    closePc();
    stopStream(s.localStream);
    clearTimers();
    set({ status: 'ended', endedReason: 'canceled', localStream: null, remoteStream: null });
  },

  acceptCall: async () => {
    const s = get();
    if (s.status !== 'incoming') return;
    clearTimers();
    const constraints: MediaStreamConstraints = s.callType === 'video'
      ? { audio: true, video: { width: { ideal: 640 }, height: { ideal: 480 } } }
      : { audio: true };
    const conn = await setupPeerConnection(set, get, constraints);
    if (!conn) return;
    sendFn?.('call_event', { conversation_id: s.conversationId, call_id: s.callId, kind: 'accept' });
    set({ status: 'active', elapsed: 0 });
    timer = setInterval(() => set({ elapsed: get().elapsed + 1 }), 1000);
  },

  rejectCall: () => {
    const s = get();
    if (s.status !== 'incoming') return;
    sendFn?.('call_event', { conversation_id: s.conversationId, call_id: s.callId, kind: 'reject' });
    closePc();
    stopStream(s.localStream);
    clearTimers();
    set({ status: 'ended', endedReason: 'rejected', localStream: null, remoteStream: null });
  },

  hangup: () => {
    const s = get();
    if (s.status !== 'active' && s.status !== 'calling' && s.status !== 'incoming') return;
    sendFn?.('call_event', { conversation_id: s.conversationId, call_id: s.callId, kind: 'hangup', reason: 'hangup' });
    closePc();
    stopStream(s.localStream);
    clearTimers();
    set({ status: 'ended', endedReason: 'hangup', localStream: null, remoteStream: null });
  },

  toggleMute: () => {
    const s = get();
    const next = !s.isMuted;
    s.localStream?.getAudioTracks().forEach((t) => { t.enabled = !next; });
    set({ isMuted: next });
  },

  toggleCamera: () => {
    const s = get();
    const next = !s.isCameraOff;
    s.localStream?.getVideoTracks().forEach((t) => { t.enabled = !next; });
    set({ isCameraOff: next });
  },

  handleWSEvent: (msg) => {
    const d = (msg.data || {}) as Record<string, unknown>;
    switch (msg.type) {
      case 'call_incoming': {
        const s = get();
        const callType = d.call_type as CallType;
        const from = d.from_user as { id: string; nickname?: string; username?: string } | undefined;
        const peerName = from?.nickname || from?.username || '对方';
        // 忙线：已在通话/振铃中 → 自动拒绝
        if (s.status !== 'idle') {
          sendFn?.('call_event', {
            conversation_id: d.conversation_id,
            call_id: d.call_id,
            kind: 'reject',
            reason: 'busy',
          });
          return;
        }
        clearTimers();
        set({
          status: 'incoming',
          callType,
          callId: d.call_id as string,
          conversationId: d.conversation_id as string,
          peerName,
          peerId: d.from_user_id as string,
          endedReason: null,
          localStream: null,
          remoteStream: null,
          elapsed: 0,
        });
        // 60s 未接听自动超时挂断
        timeoutTimer = setTimeout(() => {
          if (get().status === 'incoming') {
            sendFn?.('call_event', { conversation_id: get().conversationId, call_id: get().callId, kind: 'hangup', reason: 'timeout' });
            clearTimers();
            set({ status: 'ended', endedReason: 'timeout' });
          }
        }, 60000);
        break;
      }
      case 'call_accepted': {
        const s = get();
        if (s.status !== 'calling' || (d.call_id && s.callId && d.call_id !== s.callId)) return;
        clearTimers();
        const constraints: MediaStreamConstraints = s.callType === 'video'
          ? { audio: true, video: { width: { ideal: 640 }, height: { ideal: 480 } } }
          : { audio: true };
        setupPeerConnection(set, get, constraints).then(async (conn) => {
          if (!conn) return;
          set({ status: 'active', elapsed: 0 });
          timer = setInterval(() => set({ elapsed: get().elapsed + 1 }), 1000);
          try {
            const offer = await conn.createOffer();
            await conn.setLocalDescription(offer);
            sendSignal(get, { type: 'offer', sdp: offer.sdp });
            // 缓冲的 ICE（可能在 offer 前到达）
            for (const c of pendingCandidates) {
              try { await conn.addIceCandidate(c); } catch { /* ignore */ }
            }
            pendingCandidates = [];
          } catch {
            set({ status: 'ended', endedReason: 'failed' });
          }
        });
        break;
      }
      case 'call_rejected': {
        const s = get();
        if (s.status !== 'calling') return;
        closePc();
        stopStream(s.localStream);
        clearTimers();
        set({
          status: 'ended',
          endedReason: d.reason === 'busy' ? 'busy' : 'rejected',
          localStream: null,
          remoteStream: null,
        });
        break;
      }
      case 'call_ended': {
        const s = get();
        if (s.status === 'idle' || s.status === 'ended') return;
        closePc();
        stopStream(s.localStream);
        clearTimers();
        set({
          status: 'ended',
          endedReason: s.status === 'calling' ? 'canceled' : 'ended',
          localStream: null,
          remoteStream: null,
        });
        break;
      }
      case 'call_signal': {
        const s = get();
        if (s.status !== 'active' || !pc) return;
        const signal = d.signal as { type?: string; sdp?: string; candidate?: RTCIceCandidateInit } | null;
        if (!signal) return;
        (async () => {
          try {
            if (signal.type === 'offer' && signal.sdp) {
              await pc!.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
              const answer = await pc!.createAnswer();
              await pc!.setLocalDescription(answer);
              sendSignal(get, { type: 'answer', sdp: answer.sdp });
              for (const c of pendingCandidates) {
                try { await pc!.addIceCandidate(c); } catch { /* ignore */ }
              }
              pendingCandidates = [];
            } else if (signal.type === 'answer' && signal.sdp) {
              await pc!.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
            } else if (signal.type === 'ice' && signal.candidate) {
              if (pc!.remoteDescription) {
                await pc!.addIceCandidate(signal.candidate);
              } else {
                pendingCandidates.push(signal.candidate);
              }
            }
          } catch {
            // 媒体信令失败不影响 UI 状态机
          }
        })();
        break;
      }
    }
  },

  reset: () => {
    closePc();
    stopStream(get().localStream);
    clearTimers();
    set({
      status: 'idle',
      callType: null,
      callId: null,
      conversationId: null,
      peerName: null,
      peerId: null,
      endedReason: null,
      isMuted: false,
      isCameraOff: false,
      localStream: null,
      remoteStream: null,
      elapsed: 0,
    });
  },
}));
