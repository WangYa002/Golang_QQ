# 裂缝分割推理服务

该服务只提供内部 `POST /predict`。前端通过 Go 的带 JWT 接口访问，不要将 8001 端口公开到互联网。原模型源码和五份权重不在本仓库中，需要在运行机器上提供。

## 准备环境

使用能够运行原项目 `test.py` 的 Python/CUDA 环境（原项目 README 推荐 Python 3.10，并依赖 PyTorch、mmcv、mamba-ssm、timm 等）。先按原项目的环境说明装好模型依赖，再安装本服务依赖：

```sh
pip install -r model-service/requirements.txt
```

本机原模型目录为 `C:\Users\hwy\Desktop\ScegMamba\code`，权重目录为 `C:\Users\hwy\Desktop\ScegMamba\Pth`。五个子目录必须分别有 `checkpoint_best.pth`。部署到其他机器时，将这两个目录复制或只读挂载到该机器，然后设置相应环境变量。不要把权重提交到 Git。

## 启动

PowerShell 示例：

```powershell
$env:SCSEGAMBA_CODE_DIR = 'C:\Users\hwy\Desktop\ScegMamba\code'
$env:SCSEGAMBA_WEIGHTS_DIR = 'C:\Users\hwy\Desktop\ScegMamba\Pth'
$env:MODEL_DEVICE = 'cuda'
cd model-service
python -m uvicorn app:app --host 127.0.0.1 --port 8001 --workers 1
```

Go 默认连接 `http://localhost:8001`。如服务在另一容器或机器，启动 Go 前设置 `MODEL_BASE_URL=http://<内部地址>:8001`。只使用一个 Python worker，因为每个 worker 都会单独占用显存并载入权重。第一次选择某个权重会包含模型加载耗时；切换权重时会替换当前模型。

开发时分别启动模型服务、Go 服务和 Vite。浏览器登录后从侧边栏进入「裂缝分割」。上传图片最多 5 MiB，像素数最多 800 万。

## 验证

```sh
cd model-service
python -m unittest discover -p 'test_*.py' -v
```

自动测试覆盖图像转换和 HTTP 契约，不加载真实权重。上线前须在目标 GPU 环境中分别用五份权重各推理一张图片，并与原 `test.py` 的分割结果比较。新页面先对 logits 做 sigmoid，再以固定概率阈值绘制叠加图；原 `test.py` 使用逐图最大值归一化，因此灰度图不能直接逐像素对比。应以相同后处理方式比较。
