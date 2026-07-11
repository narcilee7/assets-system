class MiniWebComponent extends HTMLElement {
  static registry = new Map();

  constructor() {
    super();
    this._props = {};
    this._state = {};
    this._slots = new Map();

    if (this.shadow) {
      this._shadow = this.attachShadow({
        mode: this.shadow.mode || "open",
      });
    }
  }

  // lifecycle methods
  connectedCallback() {
    this._parseAttributes();
    this._parseSlots();
    this.beforeMount?.();
    this.render();
    this.mounted?.();
  }

  disconnectedCallback() {
    this.beforeUnmount();
    this._cleanup();
    this.unmounted?.();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    this._props[name] = this._castValue(name, newVal);
    this._onPropsChange?.(name, this._props[name]);
    this.render();
  }

  // attribute system
  static get observedAttributes() {
    return Object.keys(this.props) || [];
  }

  _parseAttributes() {
    const props = this.constructor.props || {};
    for (const [name, config] of Object.entries(props)) {
      const value = this.getAttribute(name);
      this._props[name] = this._castValue(name, value, config.type);
    }
  }

  _castValue(name, value, type) {
    const cfg = this.constructor.props?.[name];
    const targetVal = type || cfg?.type;
    switch (targetType) {
      case "boolean":
        return value !== null && value !== "false";
      case "number":
        return value === null ? config?.default : Number(value);
      case "json":
        try {
          return value ? JSON.parse(value) : config?.default;
        } catch {
          return config?.default;
        }
      default:
        return value ?? config?.default ?? "";
    }
  }

  get props() {
    return {
      ...this._props,
    };
  }

  setProps(updates) {
    Object.assign(this._props, updates);
    for (const [k, v] of Object.entries(updates)) {
      if (value === null || value === undefined) {
        this.removeAttribute(k);
      } else {
        this.setAttribute(k, v);
      }
    }
    this.render();
  }

  // state sys
  setState(updates) {
    const prev = { ...this._state };
    Object.assign(this._state, updates);
    this._onStateChange?.(prev);
    this.render();
  }

  get state() {
    return {
      ...this._state,
    };
  }

  // slots sys
  _parseSlots() {
    if (!this.shadow) return;

    const slots = this.querySelectorAll("[slot]");
    slots.forEach((el) => {
      this._slots.set(el.getAttribute("slot"), el);
    });

    // 默认插槽内容
    const defaultSlot = Array.from(this.childNodes).filter(
      (n) => !n.hasAttribute?.("slot"),
    );
    if (defaultSlot.length) {
      this._slots.set("default", defaultSlot);
    }
  }

  renderSlot(name = "default") {
    const content = this._slots.get(name);
    if (!content) return "";

    if (Array.isArray(content)) {
      return content.map((n) => n.outerHTML).join("");
    }

    return content.outerHTML;
  }

  // render sys
  render() {
    const tmp = this.template?.() || "";
    const html = this._processTemplate(tmp);

    if (this._shadow) {
      this._shadow.innerHTML = `<style>${this.styles?.() || ""}</style>${html}`;
    } else {
      this.innerHTML = html;
    }

    this._bindEvents();
  }

  _processTemplate(tmp) {
    return tmp
      .replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
        return this._props[key] ?? this._state[key] ?? "";
      })
      .replace(/<slot\s+name="(\w+)"\s*\/?>/g, (match, name) => {
        return this.renderSlot(name);
      })
      .replace(/<slot\s*\/?>/g, () => this.renderSlot("default"));
  }

  _bindEvents() {
    const root = this._shadow || this;
    root.querySelectorAll("[data-on]").forEach((el) => {
      const [event, handler] = el.getAttribute("data-on").split(":");
      el.addEventListener(event, (e) => {
        if (this[handler]) this[handler](e);
      });
    });
  }

  _cleanupEvents() {
    const root = this._shadow || this;
    root.querySelectorAll("[data-on]").forEach((el) => {
      const [event, handler] = el.getAttribute("data-on").split(":");
      el.removeEventListener(event, (e) => {
        if (this[handler]) this[handler](e);
      });
    });
  }

  static define(tag) {
    if (!customElements.get(tag)) {
      customElements.define(tag, this);
    }
    MiniWebComponent.registry.set(tag, this);
    return this;
  }
}
