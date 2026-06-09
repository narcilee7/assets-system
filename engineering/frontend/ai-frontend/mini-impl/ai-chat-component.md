# 手写 AI 聊天组件

## 目标

实现一个简化版 AI 聊天组件，支持：
1. 消息列表渲染（用户/AI）
2. 流式消息显示
3. 工具调用展示
4. 多模态输入（文本/图片）
5. 对话历史管理

## 实现

```javascript
// ai-chat-component.js

class AIChatComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.messages = [];
    this.isStreaming = false;
    this.conversationId = this.generateId();
  }

  static get observedAttributes() {
    return ['api-endpoint', 'placeholder', 'theme'];
  }

  connectedCallback() {
    this.apiEndpoint = this.getAttribute('api-endpoint') || '/api/chat';
    this.placeholder = this.getAttribute('placeholder') || '输入消息...';
    this.theme = this.getAttribute('theme') || 'light';
    this.render();
    this.attachEvents();
  }

  generateId() {
    return Math.random().toString(36).substring(2, 15);
  }

  // ========== 渲染 ==========

  getStyles() {
    return `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        max-height: 600px;
        border: 1px solid var(--border-color, #e5e7eb);
        border-radius: 12px;
        overflow: hidden;
        font-family: system-ui, -apple-system, sans-serif;
        background: var(--bg-color, #ffffff);
        color: var(--text-color, #1f2937);
      }
      .messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .message {
        display: flex;
        gap: 12px;
        max-width: 80%;
        animation: fadeIn 0.2s ease;
      }
      .message.user {
        align-self: flex-end;
        flex-direction: row-reverse;
      }
      .message.assistant {
        align-self: flex-start;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }
      .message.user .avatar { background: #3b82f6; }
      .message.assistant .avatar { background: #10b981; }
      .bubble {
        padding: 10px 14px;
        border-radius: 16px;
        line-height: 1.5;
        word-break: break-word;
      }
      .message.user .bubble {
        background: #3b82f6;
        color: white;
        border-bottom-right-radius: 4px;
      }
      .message.assistant .bubble {
        background: #f3f4f6;
        color: #1f2937;
        border-bottom-left-radius: 4px;
      }
      .bubble pre {
        background: #1f2937;
        color: #e5e7eb;
        padding: 12px;
        border-radius: 8px;
        overflow-x: auto;
        margin: 8px 0;
      }
      .bubble code {
        font-family: 'SF Mono', Monaco, monospace;
        font-size: 0.875em;
      }
      .bubble p { margin: 0; }
      .bubble p + p { margin-top: 8px; }
      .tool-call {
        background: #fef3c7;
        border: 1px solid #f59e0b;
        border-radius: 8px;
        padding: 8px 12px;
        margin-top: 8px;
        font-size: 0.875rem;
      }
      .tool-call .name {
        font-weight: 600;
        color: #92400e;
      }
      .tool-call .result {
        margin-top: 4px;
        padding: 4px 8px;
        background: #fff;
        border-radius: 4px;
        font-family: monospace;
        font-size: 0.8rem;
      }
      .input-area {
        display: flex;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid var(--border-color, #e5e7eb);
        background: var(--bg-color, #ffffff);
      }
      .input-area textarea {
        flex: 1;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 10px 12px;
        resize: none;
        font-family: inherit;
        font-size: 14px;
        min-height: 20px;
        max-height: 120px;
      }
      .input-area textarea:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
      }
      .input-area button {
        padding: 8px 16px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
      }
      .input-area button:hover { background: #2563eb; }
      .input-area button:disabled { opacity: 0.5; cursor: not-allowed; }
      .typing-indicator {
        display: flex;
        gap: 4px;
        padding: 8px 12px;
      }
      .typing-indicator span {
        width: 8px;
        height: 8px;
        background: #9ca3af;
        border-radius: 50%;
        animation: bounce 1.4s ease-in-out infinite;
      }
      .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
      .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes bounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1); }
      }
      .image-preview {
        max-width: 200px;
        max-height: 150px;
        border-radius: 8px;
        margin-top: 8px;
      }
      .error {
        color: #ef4444;
        font-size: 0.875rem;
        padding: 8px 16px;
      }
    `;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>${this.getStyles()}</style>
      <div class="messages" id="messages"></div>
      <div class="error" id="error" hidden></div>
      <div class="input-area">
        <textarea
          id="input"
          placeholder="${this.placeholder}"
          rows="1"
          ${this.isStreaming ? 'disabled' : ''}
        ></textarea>
        <button id="send-btn" ${this.isStreaming ? 'disabled' : ''}>发送</button>
      </div>
    `;
  }

  attachEvents() {
    const input = this.shadowRoot.getElementById('input');
    const sendBtn = this.shadowRoot.getElementById('send-btn');

    sendBtn.addEventListener('click', () => this.sendMessage());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = input.scrollHeight + 'px';
    });
  }

  // ========== 消息管理 ==========

  addMessage(role, content, options = {}) {
    const message = {
      id: this.generateId(),
      role,
      content,
      timestamp: Date.now(),
      ...options,
    };
    this.messages.push(message);
    this.renderMessage(message);
    return message;
  }

  updateMessage(id, updates) {
    const msg = this.messages.find((m) => m.id === id);
    if (msg) {
      Object.assign(msg, updates);
      this.updateMessageDOM(msg);
    }
  }

  renderMessage(message) {
    const container = this.shadowRoot.getElementById('messages');
    const el = document.createElement('div');
    el.className = `message ${message.role}`;
    el.dataset.id = message.id;
    el.innerHTML = this.buildMessageHTML(message);
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  updateMessageDOM(message) {
    const el = this.shadowRoot.querySelector(`[data-id="${message.id}"]`);
    if (el) {
      el.querySelector('.bubble').innerHTML = this.buildMessageContent(message);
    }
  }

  buildMessageHTML(message) {
    const avatar = message.role === 'user' ? '👤' : '🤖';
    return `
      <div class="avatar">${avatar}</div>
      <div class="bubble">${this.buildMessageContent(message)}</div>
    `;
  }

  buildMessageContent(message) {
    let html = this.markdownToHTML(message.content);

    if (message.toolCalls) {
      for (const tool of message.toolCalls) {
        html += `
          <div class="tool-call">
            <div class="name">🔧 ${tool.name}</div>
            <div class="result">${JSON.stringify(tool.result, null, 2)}</div>
          </div>
        `;
      }
    }

    if (message.image) {
      html += `<img src="${message.image}" class="image-preview" alt="Uploaded image">`;
    }

    return html;
  }

  markdownToHTML(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<p></p>');
  }

  showTyping() {
    const container = this.shadowRoot.getElementById('messages');
    const el = document.createElement('div');
    el.className = 'message assistant typing';
    el.id = 'typing-indicator';
    el.innerHTML = `
      <div class="avatar">🤖</div>
      <div class="bubble">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  hideTyping() {
    const el = this.shadowRoot.getElementById('typing-indicator');
    el?.remove();
  }

  showError(message) {
    const el = this.shadowRoot.getElementById('error');
    el.textContent = message;
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 5000);
  }

  // ========== 发送消息 ==========

  async sendMessage() {
    const input = this.shadowRoot.getElementById('input');
    const content = input.value.trim();
    if (!content || this.isStreaming) return;

    // 用户消息
    this.addMessage('user', content);
    input.value = '';
    input.style.height = 'auto';

    // AI 响应
    this.isStreaming = true;
    this.updateInputState();
    this.showTyping();

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: this.messages.filter((m) => m.role !== 'system').map((m) => ({
            role: m.role,
            content: m.content,
          })),
          conversationId: this.conversationId,
        }),
      });

      if (!response.ok) throw new Error('Request failed');

      this.hideTyping();

      // 处理流式响应
      const assistantMsg = this.addMessage('assistant', '');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const match = line.match(/^data: (.+)$/m);
          if (match) {
            try {
              const data = JSON.parse(match[1]);
              if (data.content) {
                assistantMsg.content += data.content;
                this.updateMessageDOM(assistantMsg);
              }
              if (data.toolCalls) {
                assistantMsg.toolCalls = data.toolCalls;
                this.updateMessageDOM(assistantMsg);
              }
            } catch {
              assistantMsg.content += match[1];
              this.updateMessageDOM(assistantMsg);
            }
          }
        }
      }
    } catch (error) {
      this.hideTyping();
      this.showError(error.message || '发送失败');
    } finally {
      this.isStreaming = false;
      this.updateInputState();
    }
  }

  updateInputState() {
    const input = this.shadowRoot.getElementById('input');
    const btn = this.shadowRoot.getElementById('send-btn');
    input.disabled = this.isStreaming;
    btn.disabled = this.isStreaming;
    btn.textContent = this.isStreaming ? '...' : '发送';
  }
}

customElements.define('ai-chat', AIChatComponent);

// ========== 使用 ==========

// HTML:
// <ai-chat api-endpoint="/api/chat" placeholder="问点什么..."></ai-chat>

module.exports = { AIChatComponent };
```
