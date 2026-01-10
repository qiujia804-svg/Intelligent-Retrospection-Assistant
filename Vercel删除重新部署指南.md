# Vercel 删除与重新部署指南

## 一、删除现有部署

### 方法1：删除单个部署实例
1. 登录 Vercel 控制台
2. 进入您的项目（Intelligent-Retrospection-Assistant）
3. 点击顶部导航栏的 `Deployments`（部署）标签
4. 找到您想要删除的部署实例
5. 点击部署实例右侧的 `...`（更多）按钮
6. 选择 `Delete`（删除）选项
7. 在确认弹窗中点击 `Delete Deployment` 确认删除

### 方法2：删除整个项目（谨慎操作）
1. 登录 Vercel 控制台
2. 进入您的项目（Intelligent-Retrospection-Assistant）
3. 点击顶部导航栏的 `Settings`（设置）标签
4. 滚动到页面底部，找到 `Danger Zone`（危险区域）
5. 点击 `Delete Project`（删除项目）按钮
6. 按照提示输入项目名称确认
7. 点击 `Delete Project` 确认删除整个项目

## 二、重新部署项目

### 方法1：通过 Vercel 控制台重新部署
1. 登录 Vercel 控制台
2. 进入您的项目（Intelligent-Retrospection-Assistant）
3. 点击顶部导航栏的 `Deployments`（部署）标签
4. 点击右上角的 `Redeploy`（重新部署）按钮
5. 在弹出的选项中，选择要部署的 Git 分支（通常是 `main` 或 `master`）
6. 可以选择是否清除构建缓存（建议勾选以确保全新部署）
7. 点击 `Redeploy` 按钮开始重新部署
8. 等待部署完成，查看部署状态

### 方法2：通过 Git 推送触发自动部署
1. 确保您的本地代码已更新到最新版本
2. 对项目进行任意修改（例如更新 README.md 文件）
3. 提交修改到 Git：
   ```bash
   git add .
   git commit -m "更新项目，触发重新部署"
   git push origin main  # 或您的主分支名称
   ```
4. Vercel 会自动检测到 Git 推送，开始重新部署
5. 您可以在 Vercel 控制台的 `Deployments` 标签中查看部署进度

### 方法3：通过 Vercel CLI 重新部署
1. 确保已安装 Vercel CLI：
   ```bash
   npm i -g vercel
   ```
2. 登录 Vercel 账号：
   ```bash
   vercel login
   ```
3. 进入项目根目录：
   ```bash
   cd d:\Intelligent-Retrospection-Assistant-master
   ```
4. 执行重新部署命令：
   ```bash
   vercel --prod
   ```
5. 按照提示完成部署配置
6. 等待部署完成

## 三、验证重新部署是否成功

1. 在 Vercel 控制台的 `Deployments` 标签中查看最新部署的状态
2. 部署成功后，点击部署实例右侧的 `Visit`（访问）按钮
3. 检查网站是否能正常访问，功能和布局是否恢复正常
4. 使用自定义域名 `https://deepmind.work` 访问，验证是否正常

## 四、常见问题解决

### 问题1：重新部署后自定义域名仍无法访问
- 检查 DNS 记录是否正确配置
- 清除浏览器缓存
- 等待 DNS 记录完全生效（通常需要 5-30 分钟）

### 问题2：部署失败
- 查看部署日志，找出具体错误原因
- 检查项目配置文件是否正确
- 确保所有依赖项都已正确安装

### 问题3：资源加载失败
- 检查 `vercel.json` 配置文件中的路由规则
- 确保资源文件路径正确
- 清除浏览器缓存，强制刷新页面

## 五、最佳实践

1. **定期备份项目代码** - 确保代码安全
2. **使用 Git 分支管理** - 避免直接修改主分支
3. **配置 CI/CD 流程** - 实现自动化部署
4. **监控部署状态** - 及时发现和解决部署问题
5. **测试自定义域名** - 确保域名绑定正常

按照以上步骤操作，您可以轻松删除和重新部署 Vercel 项目，解决自定义域名访问问题。