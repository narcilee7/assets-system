class CSSProcessor {
  constructor(ops = {}) {
    this.vars = ops.vars || {};
    this.mixins = {};
  }

  _replaceVars(str) {
    const rootMatch = str.match(/:root\s*{([^}]+)}/);
    if (rootMatch) {
      const declarations = this._parseDeclarations(rootMatch[1]);
      Object.assign(this.vars, declarations);
    }

    return css.replace(
      /var\((--[\w-]+)(?:,\s*([^)]+))?\)/g,
      (match, name, fallback) => {
        return this.vars[name] || fallback || match;
      },
    );
  }

  _parseDeclarations(block) {
    const declarations = {};
    const regex = /(--[\w-]+)\s*:\s*([^;]+);?/g;
    let match;
    while ((match = regex.exec(block)) !== null) {
      declarations[match[1].trim()] = match[2].trim();
    }
    return declarations;
  }
}
