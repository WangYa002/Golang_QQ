FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple fastapi uvicorn
COPY main.py .
EXPOSE 9000
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9000"]
