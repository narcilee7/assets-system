class MinMC extends HTMLElement {
    static registry = new Map();

    constructor() {
        super();
        this._props = {};
        this._state = {};
        this._slots = new Map();

        if (this.shadowRoot) {
            this._shadowRoot = this.attachShadow({
                mode: this.shadowRoot.mode || 'open',
            })
        }
    }

    static get observedAttributes() {
        return this.props ? Object.keys(this.props) : [];
    }

    _parseAttributes() {
        const props = this.constructor.props || {};
        for (const [name, config] of Object.entries(props)) {
            const value = this.getAttribute(name);
        }
    }
}