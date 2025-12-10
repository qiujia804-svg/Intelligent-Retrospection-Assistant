# GitHub Pages 部署指南

## 前提条件
1. 您已经创建了GitHub账号和仓库（第一步已完成）
2. 您需要在本地安装Git工具

## 步骤1：检查Git是否已安装

1. 按下 `Win + R` 键打开运行窗口
2. 输入 `cmd` 并按回车键打开命令提示符
3. 输入 `git --version` 并按回车键

   - 如果显示Git版本信息（如：`git version 2.42.0.windows.2`），则Git已安装
   - 如果显示"'git'不是内部或外部命令"，则需要先安装Git

### 安装Git（如果未安装）
1. 访问Git官网：https://git-scm.com/downloads
2. 点击Windows版本的下载链接
3. 运行下载的安装程序，按照默认选项完成安装
4. 安装完成后，重新打开命令提示符，再次输入 `git --version` 验证安装

## 步骤2：将本地项目推送到GitHub

### 2.1 打开命令行并导航到项目目录

1. 找到您的项目文件夹（h:\Github\Smart-Retro-Assistant）
2. 在文件夹路径栏中输入 `cmd` 并按回车键，这将在当前目录打开命令提示符

### 2.2 执行Git命令

在命令提示符中，依次执行以下命令：

1. **初始化Git仓库**
   ```bash
   git init
   ```
   这将在当前目录创建一个.git文件夹，用于跟踪文件变更

2. **添加所有文件到暂存区**
   ```bash
   git add .
   ```
   注意：命令中的 `.` 表示当前目录的所有文件

3. **提交文件**
   ```bash
   git commit -m "Initial commit"
   ```
   这将把暂存区的文件提交到本地Git仓库，并添加一个提交信息

4. **关联GitHub仓库**
   ```bash
   git remote add origin https://github.com/您的用户名/仓库名.git
   ```
   请将 `您的用户名` 和 `仓库名` 替换为您的实际GitHub信息
   例如：`git remote add origin https://github.com/johndoe/smart-retro-assistant.git`

5. **推送代码到GitHub**
   ```bash
   git push -u origin main
   ```
   执行此命令后，系统会提示您输入GitHub的用户名和密码或个人访问令牌
   
   - 如果您使用的是Git 2.27或更高版本，可能会弹出GitHub登录窗口
   - 如果使用旧版本，需要在命令行中输入用户名和密码

## 步骤3：启用GitHub Pages

1. 登录GitHub，进入您的仓库
2. 点击顶部导航栏的 "Settings" 选项卡
3. 在左侧菜单中选择 "Pages"
4. 在 "Build and deployment" 部分：
   - 选择 "Source" 为 "Deploy from a branch"
   - 选择 "Branch" 为 "main"
   - 选择 "Folder" 为 "/ (root)"
5. 点击 "Save" 按钮

## 步骤4：访问您的网站

- 等待几分钟后，您的网站将可以通过以下链接访问：
  ```
  https://您的用户名.github.io/仓库名/
  ```
- 例如：`https://johndoe.github.io/smart-retro-assistant/`

## 常见问题

### Q: 推送代码时出现权限错误
A: 请确保您输入了正确的GitHub用户名和密码，或者使用个人访问令牌代替密码。

### Q: 网站页面无法访问
A: 请检查GitHub Pages设置是否正确，并且等待几分钟让部署完成。

### Q: 页面样式丢失
A: 请确保所有CSS、JS和图片文件都已正确推送，并且文件路径引用正确。

### Q: 执行 `git add .` 时出现 "fatal: detected dubious ownership in repository" 错误
A: 这是由于Git检测到仓库所有权问题导致的。解决方法是将当前目录添加到Git的安全目录列表中：
```bash
git config --global --add safe.directory H:/Github/Smart-Retro-Assistant
```
请将 `H:/Github/Smart-Retro-Assistant` 替换为您的实际项目目录。

### Q: 执行 `git push -u origin main` 时出现 "error: src refspec main does not match any" 错误
A: 这是由于本地分支名称与远程分支名称不匹配导致的。您可以通过以下步骤解决：
1. 检查本地分支名称：
   ```bash
   git branch
   ```
2. 如果本地分支是 `master` 而不是 `main`，请使用以下命令推送：
   ```bash
   git push -u origin master
   ```

### Q: 执行 `git push origin master` 时出现 "fatal: unable to access 'https://github.com/...': Failed to connect to github.com port 443" 错误
A: 这是网络连接问题，可能是由于以下原因导致：
- 网络连接不稳定或中断
- 防火墙或代理设置阻止了Git连接GitHub
- GitHub服务器暂时不可用

解决方法：
- 检查您的网络连接是否正常
- 尝试重新执行推送命令
- 如果使用公司网络，检查是否需要配置代理

### Q: 执行 `git config --global --add safe.directory` 时出现 "error: wrong number of arguments, should be 2" 错误
A: 这是由于缺少目录参数导致的。请确保在命令中提供完整的目录路径：
```bash
git config --global --add safe.directory H:/Github/Smart-Retro-Assistant
```

### Q: 执行 `git push -m origin main` 时出现 "error: unknown switch `m'" 错误
A: 这是由于使用了错误的Git命令选项导致的。`git push` 命令没有 `-m` 选项，正确的命令应该是：
```bash
git push -u origin main
```
或者如果本地分支是master：
```bash
git push -u origin master
```

---


**注意：** 此指南不会修改网站的任何内容或布局，仅提供将现有网站部署到GitHub Pages的步骤。