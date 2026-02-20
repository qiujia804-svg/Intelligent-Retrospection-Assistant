# 域名配置指南

## 概述
本项目已配置支持两个域名：
- `https://deepmind.work`
- `https://www.deepmind.work`

## Vercel 配置
已在 `vercel.json` 中添加了域名配置：

```json
{
  "domains": [
    "deepmind.work",
    "www.deepmind.work"
  ]
}
```

## 部署步骤

### 1. 安装 Vercel CLI
```bash
npm i -g vercel
```

### 2. 登录 Vercel
```bash
vercel login
```

### 3. 部署项目
```bash
vercel --prod
```

### 4. 域名绑定
部署完成后，在 Vercel 控制台中：

1. 进入项目设置
2. 点击 "Domains" 选项卡
3. 添加以下域名：
   - `deepmind.work`
   - `www.deepmind.work`

### 5. DNS 配置
在您的域名注册商处，配置 DNS 记录：

**对于主域名 (deepmind.work)：**
```
Type: A
Name: @
Value: 76.76.19.61
```

**对于 www 子域名 (www.deepmind.work)：**

**方案1：使用 A 记录（推荐）**
```
Type: A
Name: www
Value: 76.76.19.61
```

**方案2：使用 CNAME 记录**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

或者使用 Vercel 的 DNS 服务器：
```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

## 验证部署

部署完成后，可以通过以下方式验证：

1. 访问 `https://deepmind.work` - 应该能正常访问网站
2. 访问 `https://www.deepmind.work` - 应该能正常访问网站
3. 两个域名都应该显示相同的内容

## 注意事项

1. 确保 SSL 证书自动配置（Vercel 会自动处理）
2. 检查重定向设置，确保 `www` 和 非 `www` 版本都能正常工作
3. 验证所有功能是否正常，包括 API 调用和静态资源加载

## 故障排除

如果域名无法访问：
1. 检查 DNS 传播状态（可能需要 24-48 小时）
2. 验证 Vercel 控制台中的域名状态
3. 检查域名是否正确添加到项目中
4. 确认 DNS 记录配置正确

## 自动部署

可以使用项目中的部署脚本：
```bash
# 运行自动部署脚本
./vercel-deploy.bat
```