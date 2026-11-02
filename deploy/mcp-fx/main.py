"""参考 MCP server（汇率）：标准 Model Context Protocol JSON-RPC over HTTP。

作为「外部 MCP 工具生态」的可插拔示例：RAG 启动/reload 时经
initialize → tools/list 发现本服务的工具，LLM 调用时走 tools/call 转发。
"""

import json
import logging
import urllib.request

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="mcp-fx")

PROTOCOL_VERSION = "2024-11-05"

TOOLS = [
    {
        "name": "exchange_rate",
        "description": "查询两种货币之间的实时汇率（基于美元中转），如 USD→CNY。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "base": {"type": "string", "description": "源货币代码，如 USD"},
                "symbol": {"type": "string", "description": "目标货币代码，如 CNY"},
            },
            "required": ["base", "symbol"],
        },
    }
]

_rates_cache: dict = {}


def fetch_rate(base: str, symbol: str) -> float | None:
    base, symbol = base.upper(), symbol.upper()
    if base == symbol:
        return 1.0
    # open.er-api.com 免 Key；缓存 10 分钟
    import time

    now = time.time()
    cached = _rates_cache.get(base)
    if cached and now - cached[0] < 600 and symbol in cached[1]:
        return cached[1][symbol]
    try:
        req = urllib.request.Request(
            f"https://open.er-api.com/v6/latest/{base}", headers={"User-Agent": "curl/8"}
        )
        with urllib.request.urlopen(req, timeout=8) as r:
            data = json.loads(r.read().decode())
        rates = data.get("rates") or {}
        _rates_cache[base] = (now, rates)
        return rates.get(symbol)
    except Exception as exc:
        logging.warning("fetch_rate failed: %s", exc)
        return None


def rpc_result(req_id, result):
    return JSONResponse({"jsonrpc": "2.0", "id": req_id, "result": result})


def rpc_error(req_id, code, message):
    return JSONResponse({"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}})


@app.post("/mcp")
async def mcp(request: Request):
    try:
        msg = await request.json()
    except Exception:
        return rpc_error(None, -32700, "parse error")
    method = msg.get("method", "")
    req_id = msg.get("id")

    if method == "initialize":
        return rpc_result(
            req_id,
            {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "mcp-fx", "version": "1.0"},
            },
        )
    if method == "notifications/initialized":
        return Response(status_code=204)
    if method == "tools/list":
        return rpc_result(req_id, {"tools": TOOLS})
    if method == "tools/call":
        params = msg.get("params") or {}
        if params.get("name") != "exchange_rate":
            return rpc_result(req_id, {"content": [{"type": "text", "text": "unknown tool"}], "isError": True})
        args = params.get("arguments") or {}
        base, symbol = args.get("base", "USD"), args.get("symbol", "CNY")
        rate = fetch_rate(base, symbol)
        if rate is None:
            text = f"汇率查询失败（{base}→{symbol}），请稍后再试。"
        else:
            text = f"当前汇率：1 {base.upper()} ≈ {rate:.4f} {symbol.upper()}。"
        return rpc_result(req_id, {"content": [{"type": "text", "text": text}]})
    if req_id is not None:
        return rpc_error(req_id, -32601, f"method not found: {method}")
    return Response(status_code=204)


@app.get("/health")
def health():
    return {"status": "ok", "server": "mcp-fx"}
