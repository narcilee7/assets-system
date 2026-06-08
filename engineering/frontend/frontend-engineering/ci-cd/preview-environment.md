# 预览环境

## 1. Vercel Preview

```
GitHub PR
   │
   ▼
Vercel 自动部署
   │
   ▼
https://my-app-git-feature-xxx.vercel.app
   │
   ▼
PR 评论中自动贴出预览链接
```

## 2. Netlify Deploy Preview

```yaml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[context.deploy-preview]
  command = "npm run build:preview"
```

## 3. 自研预览环境

```yaml
# .github/workflows/preview.yml
name: Preview
on: pull_request
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build

      - name: Deploy to S3
        run: |
          aws s3 sync dist/ s3://preview-bucket/pr-${{ github.event.number }}/

      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `🚀 Preview: https://preview.example.com/pr-${{ github.event.number }}/`
            })
```

## 4. 预览环境清理

```yaml
name: Cleanup Preview
on:
  pull_request:
    types: [closed]
jobs:
  cleanup:
    steps:
      - run: |
          aws s3 rm s3://preview-bucket/pr-${{ github.event.number }}/ --recursive
```
