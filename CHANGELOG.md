# Changelog

All notable changes to DeepRead (frontend) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- README.md — 项目概览 + 快速开始 + 架构图
- LICENSE — MIT
- CHANGELOG.md
- .github/workflows/ci.yml — lint + typecheck + e2e + build
- Dockerfile — 一键 Docker 构建

## [1.2.0] - 2026-08-23

### Added
- Workspace 视图统一（chat / search / review / compare / bibtex / similar）
- 与后端 v1.2 RAG 服务的 API 客户端（`services/deepreadApi.ts`）
- Playwright e2e 测试框架（mobile + workspace）

### Changed
- 重构 `App.tsx` 路由结构，引入 ResearchPanel 统一调度 6 个工作区
- 样式系统重构为 v1.3 layout tokens

## [1.1.0] - 2026-08-17

### Added
- Research workspace 主面板组件（ResearchPanel）
- 对话工作区（ChatView v1.3 多轮分支）
- 引用链接（CitationLink + CitationText）组件
- 相似论文发现面板（SimilarView）
- 综合综述面板（ReviewView）

### Removed
- 旧版 v0.1 panel（已替换为新版 workspace）

## [0.1.0] - 2026-08-16

### Added
- 初始版本：单页 PDF 阅读 + 基础对话
- BPMRC 结构化分析视图

[Unreleased]: https://github.com/LULU926-star/DeepRead/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/LULU926-star/DeepRead/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/LULU926-star/DeepRead/compare/v0.1.0...v1.1.0
[0.1.0]: https://github.com/LULU926-star/DeepRead/releases/tag/v0.1.0
