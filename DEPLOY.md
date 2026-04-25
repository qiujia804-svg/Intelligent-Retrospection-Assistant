# 🚀 一键部署指南

## 方案一：本地自动部署（推荐）

### 首次使用（只需一次）

1. **安装 Node.js**
   - 访问 https://nodejs.org
   - 下载 LTS 版本并安装

2. **运行自动部署脚本**
   ```bash
   auto-deploy.bat
   ```

3. **按提示完成首次登录**
   - 浏览器会自动打开 Vercel 授权页面
   - 使用 GitHub/Google/邮箱 登录
   - 授权完成后即可自动部署

### 后续更新（一键部署）

只需要双击运行 `auto-deploy.bat`，即可自动：
- 检查环境
- 登录状态验证
- 部署到生产环境
- 显示访问链接

---

## 方案二：GitHub 自动部署

### 设置步骤（只需一次）

1. **创建 GitHub 仓库**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/你的用户名/你的仓库名.git
   git push -u origin main
   ```

2. **获取 Vercel Token**
   - 访问 https://vercel.com/account/tokens
   - 创建新 Token
   - 复制 Token 值

3. **设置 GitHub Secrets**
   - 进入 GitHub 仓库 → Settings → Secrets and variables → Actions
   - 添加以下 Secrets：
     - `VERCEL_TOKEN`: 刚刚复制的 Token
     - `VERCEL_ORG_ID`: 你的 Vercel Organization ID
     - `VERCEL_PROJECT_ID`: 你的 Vercel Project ID

4. **获取 Vercel IDs**
   ```bash
   vercel link
   cat .vercel/project.json
   ```

### 后续更新（全自动）

每次推送到 main 分支，GitHub Actions 会自动部署：
```bash
git add .
git commit -m "更新内容"
git push
```

---

## 📱 部署后访问

部署成功后，你会获得类似以下的链接：
- `https://your-project.vercel.app`

可以将此链接添加到手机桌面，像 APP 一样使用！

---

## 🎯 推荐方案

| 场景 | 推荐方案 | 原因 |
|------|----------|------|
| 快速部署 | 方案一 | 无需 GitHub，本地一键完成 |
| 团队协作 | 方案二 | 代码版本管理，自动部署 |
| 频繁更新 | 方案二 | 提交即部署，无需手动操作 |

---

## ⚠️ 注意事项

1. **数据存储**：复盘数据保存在浏览器本地，部署到云端后：
   - 不同设备数据不互通
   - 清除浏览器数据会丢失记录
   - 如需跨设备同步，后续可开发账号系统

2. **免费额度**：Vercel 免费版足够个人使用
   - 每月 100GB 带宽
   - 每月 6000 分钟构建时间
   - 无限制部署次数
