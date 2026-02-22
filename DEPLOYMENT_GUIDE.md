# 智能复盘助手 - GitHub + Vercel 部署指南

## 项目信息
- **本地路径**: `D:\Intelligent-Retrospection-Assistant-master`
- **GitHub 仓库**: `https://github.com/qiujia804-svg/Intelligent-Retrospection-Assistant.git`
- **项目类型**: 纯前端静态网站 (HTML/CSS/JS)
- **数据存储**: localStorage/IndexedDB (浏览器本地存储)

---

## 方式一：使用 GitHub 网页界面上传（推荐，最简单）

### 步骤 1: 准备文件
1. 打开文件夹 `D:\Intelligent-Retrospection-Assistant-master`
2. 选择所有需要上传的文件（排除 `.git` 文件夹）
3. 压缩为 ` Intelligent-Retrospection-Assistant.zip`

**需要包含的文件和文件夹：**
```
📁 api/
📁 icons/
📁 images/
📁 review-assistant-guide/
📁 server/
📄 .gitignore
📄 admin.html
📄 chart-demo.html
📄 commercial-system.js
📄 data-repair-tool.html
📄 data-storage.js
📄 generate-qrcode.html
📄 generate-qrcode.js
📄 import-data.js
📄 import-for-browser.js
📄 index.html (主页面)
📄 manifest.json
📄 mobile.css
📄 offline.html
📄 review-assistant.css
📄 review-assistant.js
📄 robots.txt
📄 service-worker.js
📄 sitemap.xml
📄 vercel.json
```

### 步骤 2: 上传到 GitHub
1. 访问 https://github.com/qiujia804-svg/Intelligent-Retrospection-Assistant
2. 点击 "Add file" → "Upload files"
3. 拖拽或选择文件上传
4. 填写提交信息: `Initial commit`
5. 点击 "Commit changes"

---

## 方式二：使用 Vercel CLI 部署（需要登录）

### 步骤 1: 登录 Vercel
```bash
# 在终端中运行
vercel login
```
- 访问显示的链接（如 https://vercel.com/oauth/device?user_code=XXXX-XXXX）
- 在浏览器中完成授权

### 步骤 2: 部署项目
```bash
# 进入项目目录
cd "D:\Intelligent-Retrospection-Assistant-master"

# 部署到 Vercel
vercel --prod
```

---

## 方式三：使用 Git 命令行 + Token

### 步骤 1: 生成 GitHub Token
1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 勾选 `repo` 权限
4. 生成并复制 Token

### 步骤 2: 配置 Git 凭据
```bash
# 设置远程仓库（使用 Token）
git remote set-url origin https://YOUR_TOKEN@github.com/qiujia804-svg/Intelligent-Retrospection-Assistant.git

# 推送代码
git push origin master
```

---

## 方式四：Vercel 网页界面导入（推荐）

### 步骤 1: 确保代码在 GitHub
- 使用方式一或方式三将代码推送到 GitHub

### 步骤 2: 在 Vercel 导入项目
1. 访问 https://vercel.com/dashboard
2. 点击 "Add New Project"
3. 选择 "Import Git Repository"
4. 选择 `qiujia804-svg/Intelligent-Retrospection-Assistant`
5. 点击 "Import"

### 步骤 3: 配置部署
- **Framework Preset**: 选择 "Other"
- **Root Directory**: `./`
- 点击 "Deploy"

---

## 部署配置说明

### vercel.json 配置
项目已包含 `vercel.json`，配置如下：
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-store, no-cache, must-revalidate"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "redirects": [
    {
      "source": "/index.html",
      "destination": "/",
      "permanent": true
    }
  ]
}
```

### 项目特点
1. **纯静态网站**: 无需后端服务器，所有数据存储在浏览器 localStorage
2. **PWA 支持**: 包含 manifest.json 和 service-worker.js
3. **响应式设计**: 支持移动端和桌面端
4. **API 功能**: `/api/send-email.js` 用于邮件发送（Vercel Serverless Function）

---

## 部署后验证

### 1. 检查网站访问
- 访问 Vercel 分配的域名（如 `https://your-project.vercel.app`）

### 2. 功能测试清单
- [ ] 页面加载正常，无 404 错误
- [ ] CSS 样式正确显示
- [ ] 可以添加复盘记录
- [ ] 数据能保存到 localStorage
- [ ] 历史记录能正常显示
- [ ] 图表和数据概览正常加载
- [ ] 所有标签页切换正常

### 3. 清除缓存测试
```
Ctrl + Shift + Delete
选择"缓存的图片和文件"
点击"清除数据"
重新访问网站
```

---

## 常见问题

### Q1: 部署后界面混乱？
**解决**: 清除浏览器缓存，或检查 CSS 文件路径是否正确

### Q2: 资源加载 404？
**解决**: 检查 `vercel.json` 的 rewrites 配置，确保静态资源路径正确

### Q3: PWA 无法安装？
**解决**: 检查 `manifest.json` 和 `service-worker.js` 路径配置

---

## 域名配置（可选）

### 绑定自定义域名
1. 在 Vercel 项目设置中选择 "Domains"
2. 添加你的域名
3. 按照提示配置 DNS 记录

---

## 需要帮助？

如果部署过程中遇到问题，请提供：
1. 错误截图
2. 浏览器控制台错误信息（F12 → Console）
3. Vercel 部署日志
