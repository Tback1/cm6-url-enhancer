const { Plugin } = require("obsidian");
const { ViewPlugin, Decoration } = require("@codemirror/view");
const { RangeSetBuilder } = require("@codemirror/state");

module.exports = class CM6UrlPlugin extends Plugin {
    async onload() {
        console.log("🟢 [物理总线] URL 高亮插件加载成功");

        const urlRegex = /([a-z][a-z0-9+.-]*)(:)(\/\/)([^\/\s?#]+)([\/\?#].*)?/gi;

        // ==================== 1. 编辑模式 (CM6) 渲染 ====================
        this.registerEditorExtension(ViewPlugin.fromClass(class {
            constructor(view) {
                this.decorations = this.build(view);
            }
            update(update) {
                if (update.docChanged || update.viewportChanged || update.transactions) {
                    this.decorations = this.build(update.view);
                }
            }
            
            build(view) {
                const builder = new RangeSetBuilder();
                for (let { from, to } of view.visibleRanges) {
                    let pos = from;
                    while (pos < to) {
                        let line = view.state.doc.lineAt(pos);
                        const text = line.text;
                        urlRegex.lastIndex = 0;
                        let m;
                        while ((m = urlRegex.exec(text)) !== null) {
                            const start = line.from + m.index;
                            
                            builder.add(start, start + m[1].length, Decoration.mark({ class: "cm-url-scheme" }));
                            builder.add(start + m[1].length, start + m[1].length + 1, Decoration.mark({ class: "cm-url-delimiter" }));
                            builder.add(start + m[1].length + 1, start + m[1].length + 3, Decoration.mark({ class: "cm-url-delimiter" }));
                            
                            const hostStart = start + m[1].length + 3;
                            builder.add(hostStart, hostStart + m[4].length, Decoration.mark({ class: "cm-url-host" }));
                            
                            if (m[5]) {
                                const pathStart = hostStart + m[4].length;
                                builder.add(pathStart, pathStart + m[5].length, Decoration.mark({ class: "cm-url-path" }));
                            }
                        }
                        pos = line.to + 1;
                    }
                }
                return builder.finish();
            }
        }, { decorations: v => v.decorations }));

        // ==================== 2. 阅读模式与全局属性面板渲染 ====================
        this.registerMarkdownPostProcessor((element, context) => {
            this.processUrlsInElement(element);
        });

        // 【新增/增强】监听工作区激活叶片变化（切换文件/打开新标签页时精准触发）
        this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
            setTimeout(() => {
                const activeView = leaf?.view?.containerEl;
                if (activeView) {
                    this.processUrlsInElement(activeView);
                } else {
                    const container = document.app?.workspace?.containerEl;
                    if (container) this.processUrlsInElement(container);
                }
            }, 300);
        }));

        // 监听全局布局变化兜底
        this.registerEvent(this.app.workspace.on('layout-change', () => {
            setTimeout(() => {
                const container = document.app?.workspace?.containerEl;
                if (container) this.processUrlsInElement(container);
            }, 300);
        }));
        
        // 确保冷启动时 DOM 已经完全挂载再执行首扫描
        this.app.workspace.onLayoutReady(() => {
            this.processUrlsInElement(document.body);
        });
    }

    processUrlsInElement(rootElement) {
        const urlRegex = /([a-z][a-z0-9+.-]*)(:)(\/\/)([^\/\s?#]+)([\/\?#].*)?/gi;
        
        // 拦截外部链接与属性面板 URL
        rootElement.querySelectorAll('.external-link').forEach(link => {
            if (link.querySelector('.cm-url-scheme')) return;
            
            const text = link.textContent.trim();
            urlRegex.lastIndex = 0;
            const m = urlRegex.exec(text);
            if (m && m[0] === text) {
                link.innerHTML = '';
                this.buildUrlDom(link, m);
            }
        });

        // 拦截行内代码
        rootElement.querySelectorAll('code').forEach(codeBlock => {
            if (codeBlock.parentElement && codeBlock.parentElement.tagName === 'PRE') return;
            if (codeBlock.querySelector('.cm-url-scheme')) return;
            
            const text = codeBlock.textContent.trim();
            urlRegex.lastIndex = 0;
            const m = urlRegex.exec(text);
            if (m && m[0] === text) {
                codeBlock.innerHTML = '';
                this.buildUrlDom(codeBlock, m);
            }
        });
    }

    buildUrlDom(parentElem, m) {
        const scheme = document.createElement('span');
        scheme.className = "cm-url-scheme";
        scheme.textContent = m[1];
        parentElem.appendChild(scheme);

        const delim1 = document.createElement('span');
        delim1.className = "cm-url-delimiter";
        delim1.textContent = m[2];
        parentElem.appendChild(delim1);

        const delim2 = document.createElement('span');
        delim2.className = "cm-url-delimiter";
        delim2.textContent = m[3];
        parentElem.appendChild(delim2);

        const host = document.createElement('span');
        host.className = "cm-url-host";
        host.textContent = m[4];
        parentElem.appendChild(host);

        if (m[5]) {
            const path = document.createElement('span');
            path.className = "cm-url-path";
            path.textContent = m[5];
            parentElem.appendChild(path);
        }
    }

    onunload() {
        console.log("🔴 [物理总线] URL 高亮插件卸载");
    }
};