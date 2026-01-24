---
name: vercel-deployment-success-guide
overview: 创建详细的Vercel部署问题解决方案指南，总结成功修复经验，确保下次遇到相同问题时能快速解决
design:
  architecture:
    framework: react
    component: shadcn
  styleKeywords:
    - Material Design
    - Clean Documentation
    - Interactive Code
    - Search-First
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 32px
      weight: 600
    subheading:
      size: 20px
      weight: 500
    body:
      size: 16px
      weight: 400
  colorSystem:
    primary:
      - "#0EA5E9"
      - "#0284C7"
      - "#0369A1"
    background:
      - "#F8FAFC"
      - "#FFFFFF"
      - "#0F172A"
    text:
      - "#1E293B"
      - "#475569"
      - "#FFFFFF"
    functional:
      - "#10B981"
      - "#EF4444"
      - "#F59E0B"
      - "#8B5CF6"
todos:
  - id: create-navigation
    content: 创建全局导航和页面布局结构
    status: completed
  - id: build-search-home
    content: 构建可搜索的问题分类首页
    status: completed
    dependencies:
      - create-navigation
  - id: vercel-json-guide
    content: 制作vercel.json配置问题解决方案页面
    status: completed
    dependencies:
      - create-navigation
  - id: resource-paths-guide
    content: 制作资源路径问题解决方案页面
    status: completed
    dependencies:
      - create-navigation
  - id: git-issues-guide
    content: 制作Git推送问题解决方案页面
    status: completed
    dependencies:
      - create-navigation
  - id: diagnostic-wizard
    content: 添加交互式问题诊断向导工具
    status: completed
    dependencies:
      - build-search-home
  - id: code-examples
    content: 实现代码块高亮和一键复制功能
    status: completed
    dependencies:
      - vercel-json-guide
      - resource-paths-guide
      - git-issues-guide
---

## 产品概述

创建一个专业的Vercel部署问题解决方案知识库网站，专门针对动态网站（使用localStorage/IndexedDB）在本地运行正常但Vercel部署后出现界面混乱和功能缺失的问题。该指南将系统总结vercel.json配置、资源路径修复和Git推送问题的解决方案，形成可搜索、可复用的故障排查手册。

## 核心功能

- 问题分类与搜索：按配置、资源、Git等维度分类，支持全文搜索
- 分步解决方案：每个问题提供详细的排查步骤和修复方案
- 代码示例展示：包含可复制的配置代码片段和命令
- 交互式诊断工具：引导用户定位具体问题类型
- 最佳实践库：总结预防性配置建议和部署清单

## 技术栈选择

- **前端框架**：Next.js 14 + TypeScript + Tailwind CSS
- **内容管理**：Markdown文件驱动，支持代码高亮
- **部署方案**：静态导出部署到Vercel

## 系统架构

### 整体架构模式

采用静态网站生成架构，构建时渲染所有指南页面，确保快速加载和SEO友好。核心架构为：内容层(Markdown) → 解析层 → 页面模板 → 静态输出。

### 模块划分

- **内容管理模块**：负责Markdown文件的加载、解析和索引构建
- **搜索模块**：基于内容索引实现客户端全文搜索
- **UI组件模块**：可复用的指南卡片、代码块、步骤列表组件
- **交互诊断模块**：多步骤问答式故障定位向导

### 数据流

Markdown源文件 → 构建时解析生成静态页面 → 客户端搜索索引 → 用户交互查询 → 实时结果展示

## 实现细节

### 核心目录结构

```
project-root/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # 全局布局
│   │   ├── page.tsx            # 首页（问题分类与搜索）
│   │   ├── vercel-json-guide/  # vercel.json配置指南页
│   │   ├── resource-paths/     # 资源路径问题页
│   │   ├── git-issues/         # Git推送问题页
│   │   └── diagnostic/         # 交互式诊断工具
│   ├── components/
│   │   ├── CodeBlock.tsx       # 代码示例组件
│   │   ├── SearchBar.tsx       # 搜索栏
│   │   └── DiagnosticWizard.tsx # 诊断向导
│   ├── content/                # Markdown内容源文件
│   └── lib/
│       ├── search.ts           # 搜索逻辑
│       └── content-loader.ts   # 内容加载器
└── public/                     # 静态资源
```

### 关键技术实现

**搜索功能实现**：构建阶段生成内容索引JSON，客户端使用fuse.js实现模糊搜索，支持关键词高亮和结果排序。

```typescript
// 搜索接口定义
interface SearchIndex {
  id: string;
  title: string;
  content: string;
  category: string;
  slug: string;
}

// 搜索服务
class SearchService {
  async buildIndex(content: SearchIndex[]): Promise<void> { }
  async search(query: string): Promise<SearchResult[]> { }
}
```

**代码块组件**：支持语法高亮、一键复制、行号显示，使用react-syntax-highlighter实现多语言高亮。

```typescript
interface CodeBlockProps {
  language: string;
  code: string;
  showLineNumbers?: boolean;
  copyable?: boolean;
}
```

## 设计架构

采用现代文档网站设计范式，以React + TypeScript + Tailwind CSS + shadcn/ui构建。整体布局采用左侧导航、右侧内容的经典文档结构，顶部固定搜索栏。交互上强调代码示例的可操作性和搜索的即时性，通过平滑过渡动画提升浏览体验。

## 页面规划

1. **首页**：顶部大标题+搜索框，下方网格展示三大问题分类卡片
2. **vercel.json指南页**：左侧步骤导航，右侧详细配置说明和代码示例
3. **资源路径问题页**：问题现象展示、原因分析、解决方案三栏布局
4. **Git问题页**：命令行式交互设计，突出解决步骤
5. **诊断工具页**：问答式向导，逐步引导用户定位问题

## 区块设计

- **全局导航栏**：Logo、搜索框、主题切换按钮，固定顶部
- **问题分类卡片**：图标+标题+描述+问题数量标签，悬停上浮效果
- **代码示例块**：深色背景、语法高亮、顶部显示文件名、右上角复制按钮
- **步骤指示器**：带数字的垂直时间线，展示解决步骤顺序
- **诊断问答区**：卡片式问题选项，选择后展开下一步，支持进度回溯