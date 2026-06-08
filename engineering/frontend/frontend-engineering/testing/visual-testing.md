# 视觉回归测试

## 1. Chromatic

```bash
# 1. 安装
npm install --save-dev chromatic

# 2. 提交到 CI
npx chromatic --project-token=YOUR_TOKEN
```

```tsx
// .storybook/preview.ts
export default {
  parameters: {
    chromatic: {
      delay: 300,           // 截图前等待动画
      diffThreshold: 0.2,   // 差异阈值
      modes: {
        desktop: { viewport: 1200 },
        mobile: { viewport: 375 },
      },
    },
  },
};
```

## 2. Loki（本地）

```bash
# 使用 Storybook 截图
npx loki update   # 生成基线
npx loki test     # 对比差异
```

## 3. Percy

```yaml
# .github/workflows/visual.yml
- name: Percy
  run: npx percy exec -- playwright test
  env:
    PERCY_TOKEN: ${{ secrets.PERCY_TOKEN }}
```
