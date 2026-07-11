const { Writable } = require("stream");

class StreamingRenderer {
  constructor(options = {}) {
    this.bootstrapScript = options.bootstrapScript || "/main.js";
    this.suspenseId = 0;
    this.pendingPromises = new Map();
  }

  async renderToStream(component) {
    const stream = new WritableStream();
    const suspenseBoundaries = new Map();

    const shell = this._renderShell(component, suspenseBoundaries);

    stream.write("<!DOCTYPE html><html><head>");
    stream.write(`<script src="${this.bootstrapScript}" defer></script>`);
    stream.write("</head><body>");

    stream.write(shell.html);

    const pending = Array.from(suspenseBoundaries.values());
    if (pending.length > 0) {
      stream.write("<script>window.__SUSPENSE__ = {};</script>");

      // 逐个处理
      for (const boundary of pending) {
        try {
          const content = await boundary.promise;
          const replacement = this._generateReplacement(boundary.id, content);
          stream.write(replacement);
        } catch (error) {
          const errorHtml = this._generateErrorReplacement(boundary.id, error);
          stream.write(errorHtml);
        }
      }
    }

    // 结束 HTML
    stream.write("</body></html>");
    stream.end();

    return stream;
  }

  _renderShell(component, suspenseBoundaries) {
    let html = "";

    const render = (node) => {
      if (typeof node === "string" || typeof node === "number") {
        return this._escapeHtml(String(node));
      }

      if (!node || !node.type) return "";

      if (node.type === 'Suspense') {
        const id = ++this.suspenseId;
        const fallback = render(node.props.fallback;

        // 记录异步边界
        if (node.props.children?.promise) {
          suspenseBoundaries.set(id, {
            id,
            promise: node.props.children.promise,
            fallback,
          });
        }

        return `<div id="suspense-${id}">${fallback}</div>`;
      }
    };
  }
}
