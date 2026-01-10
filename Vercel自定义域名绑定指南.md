# Vercel 绑定自定义域名详细步骤（deepmind.work）

## 一、前提条件
1. 已在 Vercel 成功部署项目
2. 已购买自定义域名 deepmind.work
3. 可访问域名注册商的管理后台（如阿里云、腾讯云、GoDaddy等）

## 二、Vercel 控制台配置步骤

### 1. 登录 Vercel 控制台
- 访问 [Vercel 官网](https://vercel.com/)
- 使用部署项目时的账号登录

### 2. 进入项目设置
- 在控制台首页找到已部署的项目（Intelligent-Retrospection-Assistant）
- 点击项目进入详情页
- 点击顶部导航栏的 `Settings`（设置）选项

### 3. 添加自定义域名
- 在左侧菜单中选择 `Domains`（域名）
- 点击右侧的 `Add` 按钮
- 在输入框中输入你的自定义域名：`deepmind.work`
- 点击 `Add` 按钮确认

### 4. 查看 Vercel 生成的 DNS 记录
添加域名后，Vercel 会显示需要配置的 DNS 记录，通常包括：
- **A 记录**：指向 Vercel 的 IP 地址
- **CNAME 记录**：指向 Vercel 提供的目标域名
- **ALIAS 记录**：部分域名提供商支持的别名记录

## 三、域名注册商 DNS 配置步骤

### 1. 登录域名注册商后台
- 访问你购买 deepmind.work 域名的注册商网站
- 登录账号并进入域名管理界面

### 2. 找到 DNS 管理选项
- 在域名列表中找到 deepmind.work
- 点击管理或设置按钮
- 找到 DNS 解析或 DNS 设置选项

### 3. 添加 DNS 记录
根据 Vercel 控制台显示的记录类型，添加相应的 DNS 记录：

#### 情况一：使用 A 记录（推荐）
- **记录类型**：A
- **主机记录**：@（表示根域名 deepmind.work）
- **记录值**：输入 Vercel 提供的 IP 地址（通常是 76.76.21.21 等）
- **TTL**：默认值或设置为 10 分钟

#### 情况二：使用 CNAME 记录（适用于 www 子域名）
- **记录类型**：CNAME
- **主机记录**：www
- **记录值**：输入 Vercel 提供的目标域名（如 cname.vercel-dns.com）
- **TTL**：默认值或设置为 10 分钟

### 4. 同时添加 www 子域名（可选）
为了让 www.deepmind.work 也能访问你的网站，建议同时添加：
- 对于根域名使用 A 记录的情况，www 子域名添加 CNAME 记录
- 或在 Vercel 控制台添加 www.deepmind.work 域名，按相同步骤配置

## 四、验证域名绑定

### 1. 等待 DNS 生效
- DNS 记录更新通常需要 5-30 分钟生效，部分地区可能需要更长时间
- 可以使用 `nslookup deepmind.work` 命令检查 DNS 记录是否生效

### 2. 验证 HTTPS 配置
- Vercel 会自动为绑定的域名配置 HTTPS
- 等待 DNS 生效后，Vercel 会显示域名状态为 `Ready`
- 此时可以通过 https://deepmind.work 访问你的网站

### 3. 确认域名解析
- 在浏览器中输入 `https://deepmind.work`
- 确认能正常访问你的项目
- 检查地址栏是否显示安全锁图标（表示 HTTPS 配置成功）

## 五、常见问题及解决方案

### 1. DNS 记录不生效
- 检查 DNS 记录是否正确添加
- 等待更长时间（最长可能需要 24 小时）
- 清除本地 DNS 缓存

### 2. HTTPS 证书问题
- Vercel 通常会自动生成证书，如遇到问题可在 Domains 设置中点击 `Verify` 按钮
- 确保 DNS 记录已正确生效

### 3. 子域名访问问题
- 确保每个子域名都已在 Vercel 控制台添加并配置相应的 DNS 记录

## 六、额外优化建议

### 1. 设置默认域名
在 Vercel 控制台的 Domains 设置中，点击 `Make Primary` 将 deepmind.work 设置为默认域名

### 2. 启用强制 HTTPS
在 Vercel 控制台的 Domains 设置中，确保 `Enforce HTTPS` 选项已开启

### 3. 添加域名验证
根据 Vercel 提示完成域名所有权验证，确保域名安全

## 七、完成

完成以上步骤后，你的 Vercel 项目将成功绑定到自定义域名 deepmind.work，访问该域名即可看到你的项目。

---

**注意**：不同域名注册商的界面可能略有不同，但 DNS 配置的核心步骤是一致的。如果遇到具体问题，建议参考域名注册商的官方文档或联系其客服支持。