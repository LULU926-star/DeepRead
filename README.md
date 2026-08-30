# DeepRead · Research Workspace

> A grounded paper-reading workspace that ties every AI output back to a real paragraph in the PDF.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg)](https://www.typescriptlang.org)
[![Vite 6](https://img.shields.io/badge/Vite-6-646cff.svg)](https://vitejs.dev)

## 一句话定位

DeepRead 是一个面向学术文献阅读的本地工作台，让 AI 输出每一条都能点回 PDF 原段落。

## ✨ Features

- **引用溯源对话**：每条 AI 输出都标注 chunk_id + page_index，点击直接跳到 PDF 原文高亮
- **跨论文综合综述**：从方法比较、时间演进、局限性、应用场景、自定义 5 个角度跨多篇论文综合
- **方法对比 / BibTeX 导出 / 相似论文发现**：完整学术工作流
- **分享与导出**：对话生成可分享链接（含来源快照）
- **6 个工作区**：对话 / 检索 / 综合综述 / 方法对比 / BibTeX / 相似论文

## 🏗️ 架构

```
┌─────────────────────────┐         ┌─────────────────────────┐
│  deepread-web (前端)     │         │ deepread-agent (后端)    │
│  React 19 + Vite + TS   │  /api/* │ Python 3.11 + FastAPI   │
│  github.com/LULU926-    │ ──────► │ 48 MCP tools            │
│  star/DeepRead          │         │ Chroma + BGE-M3 + SQLite│
│                         │         │ (即将开源)              │
└─────────────────────────┘         └─────────────────────────┘
```

> **后端** DeepRead Agent (Python + FastAPI + MCP) 将在另一个仓库 [LULU926-star/DeepRead-Agent](https://github.com/LULU926-star/DeepRead-Agent) 开源（PR 中）。

## 🚀 Quick Start（仅前端 mock demo）

⚠️ **当前仓库仅前端开源**。完整功能需要搭配后端（`LULU926-star/DeepRead-Agent`，开源中）。如需在没有后端的情况下预览前端 UI：

```bash
git clone https://github.com/LULU926-star/DeepRead.git
cd DeepRead
npm install
npm run dev
```

打开 http://localhost:3000 即可看到 UI。**实际功能需要后端**（仓库未启动时 API 会返回 `无法连接 DeepRead 后端` 提示）。

### 启动后端的完整流程（待后端开源后）

```bash
# 1. 克隆并启动后端（PR 后）
git clone https://github.com/LULU926-star/DeepRead-Agent.git
cd DeepRead-Agent
pip install -e .
cp .env.example .env  # 填入 API key
python -m mcp_server.server   # 或 python -m web_api.app

# 2. 在另一个终端启动前端
cd ../DeepRead
npm run dev
```

Vite dev server 已配置 `/api` 代理到 `http://127.0.0.1:8000`，开箱即用。

## 🧪 E2E 测试

```bash
npm install
npx playwright install chromium
npm run dev  # 在另一个终端
npm run test:e2e
```

E2E 测试覆盖：workspace chrome / 创建 session / 论文上传 / 跨论文检索等核心路径。

## 🛠️ Tech Stack

| Layer | 技术 |
|---|---|
| Framework | React 19 |
| Build | Vite 6 + TypeScript 5.8 |
| UI | 手写 CSS（863 行）+ lucide-react 图标 |
| E2E | Playwright 1.62 |
| API Client | fetch + 自写 deepreadApi client |

## 📁 项目结构

```
DeepRead/
├── App.tsx                  # 主应用（488 行，session/paper/conversation 状态）
├── components/              # 21 个 UI 组件
│   ├── ChatView.tsx         # 对话工作区（含 query rewriting→retrieving→generating→validating 5 阶段状态机）
│   ├── CitationLink.tsx     # 引用角标（点击触发 PDF 跳转）
│   ├── CitationText.tsx     # 引用解析（occurrences 优先，正则 fallback）
│   ├── ReviewView.tsx       # 跨论文综合综述（5 个角度）
│   ├── ComparisonView.tsx   # 方法对比
│   ├── BibtexView.tsx       # BibTeX 导出
│   ├── SimilarView.tsx      # 相似论文发现
│   ├── ConversationShareExport.tsx  # 对话分享导出
│   └── ...                  # 其余 13 个组件
├── services/
│   └── deepreadApi.ts       # /api/* 客户端
├── tests/e2e/               # Playwright e2e
├── index.css                # 工作区样式（v1.3 tokens）
└── metadata.json            # 元信息（用于扩展市场展示）
```

## 🎯 Workspace 6 个标签（`types.ts` WorkspaceView）

| 标签 | 功能 | 关键组件 |
|---|---|---|
| 对话 | 引用溯源多轮对话 | ChatView / ChatComposer / ChatTurn |
| 检索 | 跨论文全文检索 | SearchView |
| 综合综述 | 5 角度跨论文综述 | ReviewView |
| 方法对比 | 多论文方法学对比 | ComparisonView |
| BibTeX | 一键导出 | BibtexView |
| 相似论文 | 基于索引的相似度 | SimilarView |

## 🤝 贡献

欢迎 PR！建议先开 issue 讨论大改动。详见 [CONTRIBUTING](.github/CONTRIBUTING.md)（待补）。

## 📜 License

[MIT](LICENSE)

## 🙋‍♀️ 作者

Lulu · [github.com/LULU926-star](https://github.com/LULU926-star)
