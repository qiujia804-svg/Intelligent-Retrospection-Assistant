---
name: fix-vercel-deployment
overview: 修复Vercel部署后的界面混乱和功能缺失问题，通过检查资源配置、优化部署配置并重新部署
todos:
  - id: explore-project-structure
    content: 使用[subagent:code-explorer]探索项目文件结构
    status: completed
  - id: check-resource-paths
    content: 检查并修复HTML中的资源引用路径
    status: completed
    dependencies:
      - explore-project-structure
  - id: configure-vercel
    content: 创建或更新vercel.json配置文件
    status: completed
    dependencies:
      - check-resource-paths
  - id: redeploy-vercel
    content: 清理Vercel缓存并触发重新部署
    status: completed
    dependencies:
      - configure-vercel
  - id: verify-deployment
    content: 验证部署后的界面布局和功能完整性
    status: completed
    dependencies:
      - redeploy-vercel
---

## 产品概述

静态HTML网站项目，在本地Git仓库中运行正常，部署到Vercel后出现界面布局混乱和功能缺失问题。

## 核心功能

- 修复Vercel部署后的资源路径问题
- 恢复界面正常布局和功能
- 确保生产环境与本地开发环境一致性

## 技术栈

- 前端：静态HTML + CSS + JavaScript
- 部署平台：Vercel

## 架构分析

### 项目结构

这是一个静态网站项目，主要包含HTML页面、CSS样式表、JavaScript脚本和静态资源（图片、字体等）。

### 常见问题分析

部署后问题通常由以下原因导致：

1. 资源路径配置错误（相对路径与绝对路径）
2. Vercel构建输出目录配置不正确
3. 大小写敏感问题（Windows本地不敏感，Linux服务器敏感）
4. 缓存问题导致旧版本资源未更新

### 核心目录结构

```
project-root/
├── index.html              # 主页文件
├── css/                    # 样式文件目录
│   └── style.css
├── js/                     # 脚本文件目录
│   └── main.js
├── assets/                 # 静态资源目录
│   ├── images/
│   └── fonts/
└── vercel.json            # Vercel配置文件（需检查或创建）
```

### 技术实施计划

**1. 资源路径检查**

- 问题：HTML文件中引用的CSS/JS路径可能使用了错误的路径格式
- 解决方案：统一使用相对路径或正确的绝对路径格式
- 步骤：

1. 检查所有HTML文件中的link和script标签
2. 确保资源路径使用相对路径（如./css/style.css）或根路径（如/css/style.css）
3. 检查图片和其他静态资源的路径引用

**2. Vercel配置优化**

- 问题：缺少vercel.json或配置不正确
- 解决方案：创建或更新vercel.json配置文件
- 步骤：

1. 检查项目根目录是否存在vercel.json
2. 配置正确的构建输出目录（通常为"."或"public"）
3. 配置路由重写规则（如需要SPA支持）
4. 配置缓存策略

**3. 部署流程修复**

- 问题：缓存导致旧版本未被更新
- 解决方案：清理缓存并重新部署
- 步骤：

1. 在Vercel控制台清理项目缓存
2. 触发重新部署
3. 使用无缓存模式部署（force deploy）

### 集成点

- **Vercel平台**：通过vercel.json配置部署参数
- **Git仓库**：确保代码已推送并触发部署

## Agent Extensions

### SubAgent

- **code-explorer**
- 用途：探索项目文件结构，快速定位HTML、CSS、JS文件及资源引用路径
- 预期结果：生成项目文件树和关键资源路径清单，为路径修复提供依据