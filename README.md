# 📖 English Reading — 英语外刊阅读器

一个简洁优雅的英语外刊阅读 Web 应用，聚合 **The Economist（经济学人）、The New Yorker（纽约客）、The Atlantic（大西洋月刊）、Wired（连线）** 四大顶级英文期刊，助力英语学习。

**🌐 在线体验：** `https://你的用户名.github.io/english-reading`

---

## ✨ 功能特性

### 📚 内容
- **199 篇真实期刊文章**，来自 10 期原版杂志（2026.04–2026.05）
- 按期刊和难度（初级 / 中级 / 高级 / 专家）双维度筛选
- 兴趣偏好排序，支持 11 个话题标签

### 📖 阅读体验
- 简洁沉浸式阅读界面，衬线字体排版
- **点击任意单词** → 弹出中文释义 + 美式发音朗读
- 逐句翻译：每句话下方显示中文
- 全文翻译：文末显示完整中文译文
- 可调节字体、字号、行距、页面宽度

### 🎓 学习辅助
- 考试词库标注：**雅思 / 托福 / GRE** 词汇自动高亮
- 分级词汇高亮：B1/C1/C2 等级别可选
- 英英释义 / 简明释义切换
- 阅读进度追踪 + 每日目标

### ⚙️ 个性化
- 浅色 / 深色 / 跟随系统主题
- 简体中文 / English 双语界面
- 阅读障碍友好字体 (OpenDyslexic)
- 沉浸模式（自动隐藏顶栏）

### 📱 平台
- PWA 支持，可添加到手机主屏幕，离线使用
- Android Chrome / 桌面浏览器全适配

---

## 🚀 快速开始

```bash
# 克隆仓库
git clone https://github.com/你的用户名/english-reading.git
cd english-reading

# 直接用浏览器打开（本地文件）
open index.html

# 或用任意 HTTP 服务器
python3 -m http.server 8000
# 然后访问 http://localhost:8000
```

---

## 🏗️ 项目结构

```
english-reading/
├── index.html          ← 入口页面
├── manifest.json       ← PWA 配置文件
├── sw.js               ← Service Worker（离线缓存）
├── css/
│   └── style.css       ← 全局样式（移动端优先）
├── js/
│   ├── app.js          ← 主应用逻辑、路由、设置面板
│   ├── data.js         ← 199 篇文章数据（内嵌）
│   ├── reader.js       ← 阅读器核心（查词、翻译、高亮）
│   ├── settings.js     ← 设置引擎 + 考试词库
│   ├── dictionary.js   ← 单词查询 + 语音合成
│   └── translator.js   ← 逐句/全文翻译
└── data/
    └── articles.json   ← 文章源数据
```

---

## 🔧 数据来源

文章提取自 [awesome-english-ebooks](https://github.com/hehonghui/awesome-english-ebooks)，使用流水线自动从 EPUB 提取文本、分割文章、评定难度。新增杂志期数只需运行：

```bash
python3 pipeline.py
```

---

## 📝 技术栈

- 纯原生 HTML / CSS / JavaScript，无框架依赖
- [Free Dictionary API](https://dictionaryapi.dev/) — 单词释义
- [MyMemory API](https://mymemory.translated.net/) — 机器翻译
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) — 美式发音
- Service Worker + Cache API — 离线 PWA

---

## 📄 License

MIT
