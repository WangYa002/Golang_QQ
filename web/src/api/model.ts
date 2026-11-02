import { authHeaders, request } from './client';

export interface ModelWeight {
  id: string;
  label: string;
}

export interface ModelPrediction {
  mask: string;
  width: number;
  height: number;
  inference_ms: number;
}

export async function getModelWeights(): Promise<ModelWeight[]> {
  const data = await request<{ models: ModelWeight[] }>('/model/weights');
  return data.models;
}

export async function predictModel(model: string, file: File): Promise<ModelPrediction> {
  const form = new FormData();
  form.append('model', model);
  form.append('file', file);
  const response = await fetch('/api/model/predict', {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 502) throw new Error('模型服务暂不可用，请联系管理员检查推理进程');
    throw new Error(data?.error || data?.detail || '推理失败，请稍后重试');
  }
  return data as ModelPrediction;
}
