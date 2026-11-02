// 测试驱动脚本：以指定用户身份通过 WebSocket 发送一条私聊消息。
// 用法: node ws-send.mjs <token> <conversationId> <content>
const [token, convoId, content] = process.argv.slice(2);
if (!token || !convoId || !content) {
  console.error("usage: node ws-send.mjs <token> <convoId> <content>");
  process.exit(1);
}
const ws = new WebSocket(`ws://localhost:8080/ws?token=${token}`);
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "chat",
    data: { conversation_id: convoId, type: "text", content },
  }));
};
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data.toString());
  if (msg.type === "new_message") {
    console.log("DELIVERED", msg.data?.id ?? "?");
    ws.close();
    process.exit(0);
  }
};
setTimeout(() => { console.error("TIMEOUT no delivery"); process.exit(2); }, 8000);
