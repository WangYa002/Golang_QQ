# 裂缝分割展示页设计

## 目标与范围

在已登录的桌面 Web 界面增加独立的「裂缝分割」页。用户选择 Crack500、CrackMap、DeepCrack、Facade390 或 TUT 权重，上传一张 PNG/JPEG 图片，查看原图、灰度概率图与可调阈值的红色叠加结果，并可下载结果。首版不包含样例图库、批处理、视频、实验指标或移动端入口。

## 架构

React 页面经带 JWT 的 `POST /api/model/predict` 发送 multipart 表单字段 `model`、`file`。Go 限制图片格式及 5 MiB 大小，按五个 ID 白名单校验，转发到内部 Python 服务。Python 服务从 `SCSEGAMBA_CODE_DIR` 载入现有 `models.build_model`，从 `SCSEGAMBA_WEIGHTS_DIR/<ID>/checkpoint_best.pth` 载入权重。模型按需加载，一次只保留一个在内存中，以限制显存。返回与原图同尺寸的 8 位灰度概率 PNG（base64 data URL）及推理耗时。前端根据用户阈值生成叠加图；原图和推理结果不持久化。

## 推理口径

复用原测试流程的 RGB 输入、512×512 resize、`(x/255-0.5)/0.5` 归一化。模型输出作为 logits，先 sigmoid 得到概率，再插值回原图尺寸。这样阈值具有明确的概率语义；需与既有脚本输出进行样本对比，不能把首版结果冒充原论文指标。

## 运行与失败反馈

Python 服务仅监听内部地址；Go 用 `MODEL_BASE_URL` 配置上游地址，未运行时返回 502。权重缺失、图片无效和模型加载失败都反馈明确错误。模型代码与五份约 335 MB 权重来自用户本机目录，不提交 Git；部署时将其只读挂载到 Python 服务。运行环境需要与现有 Mamba CUDA 扩展兼容，首版不转换 ONNX。

## 验收

Go 校验与代理测试通过；Python 预处理/后处理测试通过；前端构建通过；在可用模型环境上五份权重各跑通一张图并核对输出。若本机缺少模型运行依赖，必须明确记录该项未验证。
