# 手写 Release 脚本

## 核心目标

实现一个简化版 Release 脚本，支持：
1. 根据 Conventional Commits 生成 CHANGELOG
2. 自动提升版本号（SemVer）
3. 创建 Git Tag
4. 发布到 NPM

## 实现

```javascript
// release.js
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const PKG_PATH = path.resolve('package.json');

function getCommitsSinceLastTag() {
  const lastTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
  const commits = execSync(`git log ${lastTag}..HEAD --pretty=format:"%s"`, { encoding: 'utf8' });
  return commits.split('\n').filter(Boolean);
}

function determineVersionBump(commits) {
  let major = false, minor = false, patch = false;

  for (const commit of commits) {
    if (commit.startsWith('BREAKING CHANGE:') || commit.includes('!:')) {
      major = true;
    } else if (commit.startsWith('feat:') || commit.startsWith('feat(')) {
      minor = true;
    } else if (commit.startsWith('fix:') || commit.startsWith('fix(')) {
      patch = true;
    }
  }

  if (major) return 'major';
  if (minor) return 'minor';
  return 'patch';
}

function bumpVersion(current, bump) {
  const [major, minor, patch] = current.split('.').map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function generateChangelog(commits, version) {
  const date = new Date().toISOString().split('T')[0];
  const sections = {
    feat: [],
    fix: [],
    docs: [],
    refactor: [],
    other: [],
  };

  for (const commit of commits) {
    if (commit.startsWith('feat:') || commit.startsWith('feat(')) {
      sections.feat.push(commit.replace(/^feat(?:\(.+\))?:\s*/, ''));
    } else if (commit.startsWith('fix:') || commit.startsWith('fix(')) {
      sections.fix.push(commit.replace(/^fix(?:\(.+\))?:\s*/, ''));
    } else if (commit.startsWith('docs:') || commit.startsWith('docs(')) {
      sections.docs.push(commit.replace(/^docs(?:\(.+\))?:\s*/, ''));
    } else if (commit.startsWith('refactor:') || commit.startsWith('refactor(')) {
      sections.refactor.push(commit.replace(/^refactor(?:\(.+\))?:\s*/, ''));
    } else {
      sections.other.push(commit);
    }
  }

  let changelog = `## [${version}] - ${date}\n\n`;
  if (sections.feat.length) {
    changelog += `### Features\n${sections.feat.map((c) => `- ${c}`).join('\n')}\n\n`;
  }
  if (sections.fix.length) {
    changelog += `### Bug Fixes\n${sections.fix.map((c) => `- ${c}`).join('\n')}\n\n`;
  }
  if (sections.docs.length) {
    changelog += `### Documentation\n${sections.docs.map((c) => `- ${c}`).join('\n')}\n\n`;
  }
  if (sections.refactor.length) {
    changelog += `### Refactors\n${sections.refactor.map((c) => `- ${c}`).join('\n')}\n\n`;
  }

  return changelog;
}

async function release() {
  // 1. 确保工作区干净
  const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  if (status) {
    console.error('Working tree is not clean. Commit or stash changes first.');
    process.exit(1);
  }

  // 2. 获取提交
  const commits = getCommitsSinceLastTag();
  if (commits.length === 0) {
    console.log('No new commits since last tag. Nothing to release.');
    return;
  }

  // 3. 确定版本提升
  const bump = determineVersionBump(commits);
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  const newVersion = bumpVersion(pkg.version, bump);

  console.log(`Bumping ${pkg.version} → ${newVersion} (${bump})`);

  // 4. 更新 package.json
  pkg.version = newVersion;
  fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');

  // 5. 生成 CHANGELOG
  const changelog = generateChangelog(commits, newVersion);
  const changelogPath = path.resolve('CHANGELOG.md');
  const existing = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '# Changelog\n\n';
  fs.writeFileSync(changelogPath, existing.replace('# Changelog\n\n', '# Changelog\n\n' + changelog));

  // 6. 提交 + Tag
  execSync('git add package.json CHANGELOG.md');
  execSync(`git commit -m "chore(release): v${newVersion}"`);
  execSync(`git tag v${newVersion}`);

  // 7. 推送
  console.log('Pushing to remote...');
  execSync('git push origin main --tags');

  // 8. 发布到 NPM
  console.log('Publishing to NPM...');
  execSync('npm publish --access public');

  console.log(`Released v${newVersion} successfully!`);
}

release().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## 使用

```bash
# 1. 使用 Conventional Commits
git commit -m "feat(button): add new variant"
git commit -m "fix(modal): close on escape key"
git commit -m "docs: update README"

# 2. 运行 Release
node release.js

# 输出：
# Bumping 1.2.3 → 1.3.0 (minor)
# Pushing to remote...
# Publishing to NPM...
# Released v1.3.0 successfully!
```
