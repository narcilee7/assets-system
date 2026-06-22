const fs = require("fs");
const path = require("path");
const { transformSync } = require("@swc/core");
const postcss = require("postcss");

const SRC = path.resolve("src");
const DIST = path.resolve("dist");

async function clean() {
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
  }
  fs.mkdirSync(DIST, { recursive: true });
}

async function compileJS(filePath) {
  const code = fs.readFileSync(filePath, "utf8");

  // ESM
  const esm = transformSync(code, {
    jsc: { parser: { syntax: "typescript", tsx: true }, target: "es2020" },
    module: { type: "es6" },
  });

  // CJS
  const cjs = transformSync(code, {
    jsc: { parser: { syntax: "typescript", tsx: true }, target: "es2020" },
    module: { type: "commonjs" },
  });

  return { esm: esm.code, cjs: cjs.code };
}

async function compileCSS(filePath) {
  const code = fs.readFileSync(filePath, "utf8");
  const result = await postcss([require("autoprefixer")]).process(code, {
    from: filePath,
  });
  return result.css;
}

async function build() {
  await clean();

  const components = fs.readFileSync(SRC).filter((f) => {
    return (
      fs.statSync(path.join(SRC, f)).isDirectory() &&
      f !== "index.ts" &&
      f !== "index.js"
    );
  });

  // for components
  for (const component of components) {
    const componentDir = path.join(SRC, component);
    const files = fs.readdirSync(componentDir);

    const tsFile = files.find((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
    const cssFile = files.find((f) => f.endsWith(".css"));

    if (!tsFile) continue;

    const outDir = path.join(DIST, component);

    fs.mkdirSync(outDir, {
      recursive: true,
    });

    const { esm, cjs } = await compileJS(path.join(componentDir, tsFile));
    fs.writeFileSync(path.join(outDir, "index.esm.js"), esm);
    fs.writeFileSync(path.join(outDir, "index.cjs.js"), cjs);

    if (cssFile) {
      const css = await compileCSS(path.join(componentDir, cssFile));
      fs.writeFileSync(path.join(outDir, "index.css"), css);
    }
  }

  const { esm, cjs } = await compileJS(path.join(SRC, "index.ts"));
  fs.writeFileSync(path.join(DIST, "index.esm.js"), esm);
  fs.writeFileSync(path.join(DIST, "index.cjs.js"), cjs);

  const exports = {
    ".": {
      import: "./index.js",
      require: "./index.cjs",
    },
  };

  for (const compnent of components) {
    exports[`./${compnent}`] = {
      import: `./${compnent}/index.js`,
      require: `./${compnent}/index.cjs`,
    };
    exports[`.${compnent}/style.css`] = `./${compnent}/index.css`;
  }

  console.log("Build complete!");
  console.log("Exports:", JSON.stringify(exports, null, 2));
}
