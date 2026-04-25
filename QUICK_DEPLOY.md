# 🚀 30秒手动部署指南

## 方法：Vercel 拖拽部署（最简单）

### 步骤 1：打包项目
1. 打开文件管理器，进入项目目录 `D:\AI tool\Intelligent-Retrospection-Assistant-master`
2. **选中所有文件**（Ctrl+A）
3. 右键 → "发送到" → "压缩文件夹"
4. 得到 `Intelligent-Retrospection-Assistant-master.zip`

### 步骤 2：Vercel 部署
1. 访问 https://vercel.com/new
2. 点击 "Import Git Repository" 下方的 **"Upload"** 按钮
3. 拖拽或选择刚才的 zip 文件
4. 点击 **"Deploy"**

### 步骤 3：完成
- 等待约 30 秒
- 获得专属链接：`https://your-project.vercel.app`
- 复制链接，添加到浏览器书签/手机桌面

---

## 📝 备选方案：GitHub + Vercel 自动部署

### 首次设置（5分钟）
1. **创建 GitHub 仓库**
   - 访问 https://github.com/new
   - 仓库名：`intelligent-retrospection-assistant`
   - 点击 "Create repository"

2. **上传代码**
   ```bash
   # 在项目目录打开 CMD
   git init
   git add .
   git commit -m "initial"
   git branch -M main
   git remote add origin https://github.com/你的用户名/intelligent-retrospection-assistant.git
   git push -u origin main
   ```

3. **连接 Vercel**
   - 访问 https://vercel.com/new
   - 选择 GitHub → 选择你的仓库 → Import
   - 点击 "Deploy"

### 后续更新
只需执行：
```bash
git add .
git commit -m "更新内容"
git push
```
Vercel 会自动重新部署！

---

## 📱 添加到手机桌面

**iPhone (Safari):**
1. 打开部署后的网站
2. 点击分享按钮 → "添加到主屏幕"

**Android (Chrome):**
1. 打开部署后的网站
2. 菜单 → "添加到主屏幕"

---

## ⚡ 推荐
- **快速体验**：方法 1（拖拽部署）
- **长期使用**：方法 2（GitHub 自动部署）

部署完成后，你就可以在任何设备上访问复盘助手了！
