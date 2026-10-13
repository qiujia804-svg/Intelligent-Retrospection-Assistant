/* ============================================================
   mobile-segments.js — 移动端 tab 内分段切换（第七阶段 2026-10-13）
   参照小程序「趋势/分类/分析」分段控件：把每个过长 tab 的大区块
   拆成可切换的子界面。
   功能零改动：仅切换 display，所有输入/提交/图表/云同步逻辑不受
   影响；桌面端（无 body.mobile-mode）完全不生效。
   ============================================================ */
(function () {
    'use strict';

    var TABS = [
        {
            tab: 'review-content',
            segs: [
                { icon: '📝', label: '写复盘', sel: ['#review-form'] },
                { icon: '✨', label: 'AI 复盘', ai: true },
                { icon: '📊', label: '数据概览', sel: ['.data-overview'] }
            ]
        },
        {
            tab: 'plan-content',
            segs: [
                { icon: '🎯', label: '四象限', sel: ['#plan-form .quadrants'] },
                { icon: '⏰', label: '时间管理', sel: ['#plan-form .time-management'] }
            ]
        },
        {
            tab: 'history-content',
            segs: [
                { icon: '📈', label: '时光分析', sel: ['.data-insight-panel'] },
                { icon: '🗂️', label: '历史记录', sel: ['.history-controls', '#history-list', '#history-detail'] }
            ]
        }
    ];

    var MAX_TRIES = 100; // 50ms × 100 = 5s，超时保持原样不报错

    function waitFor(get, cb, tries) {
        var v = get();
        if (v) { cb(v); return; }
        if ((tries || 0) >= MAX_TRIES) return;
        setTimeout(function () { waitFor(get, cb, (tries || 0) + 1); }, 50);
    }

    // 切换分段后广播 resize，让 echarts（雷达/柱状）与 Chart.js 重排版
    function dispatchResize() {
        try {
            window.dispatchEvent(new Event('resize'));
            setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 380);
        } catch (e) { /* 忽略 */ }
    }

    function initTab(cfg) {
        var tabEl = document.getElementById(cfg.tab);
        if (!tabEl || tabEl.querySelector('.mtb-bar')) return; // 防重复注入

        var bar = document.createElement('div');
        bar.className = 'mtb-bar';
        bar.setAttribute('role', 'tablist');

        var h2 = tabEl.querySelector(':scope > h2');
        if (h2 && h2.insertAdjacentElement) {
            h2.insertAdjacentElement('afterend', bar);
        } else {
            tabEl.insertBefore(bar, tabEl.firstChild);
        }

        var state = { segs: [], active: 0 };

        function apply(idx) {
            state.active = idx;
            var items = bar.querySelectorAll('.mtb-item');
            for (var k = 0; k < items.length; k++) {
                items[k].classList.toggle('active', k === idx);
            }
            state.segs.forEach(function (seg, i) {
                seg.blocks.forEach(function (el) {
                    el.classList.toggle('mtb-hidden', i !== idx);
                });
            });
            dispatchResize();
        }

        cfg.segs.forEach(function (s, i) {
            var blocks = [];
            (s.sel || []).forEach(function (sel) {
                var el = tabEl.querySelector(sel);
                if (el) { el.classList.add('mtb-block'); blocks.push(el); }
            });

            // 先登记分段（ai 分支的回调可能在 apply(0) 之前同步触发，
            // 必须保证 state.segs[i] 已存在，否则卡片永远不被隐藏）
            state.segs.push({ icon: s.icon, label: s.label, blocks: blocks });

            // AI 视图：把 ai-review.js 注入的「AI帮我复盘」按钮包成居中卡片
            if (s.ai) {
                waitFor(function () { return tabEl.querySelector('.ai-review-entry'); }, function (btn) {
                    var card = document.createElement('div');
                    card.className = 'mtb-ai-card mtb-block';
                    var hint = document.createElement('p');
                    hint.className = 'mtb-ai-hint';
                    hint.textContent = '根据今天的时间安排，AI 自动生成复盘草稿，填入「写复盘」表单';
                    if (btn.parentNode) {
                        btn.parentNode.insertBefore(card, btn);
                        card.appendChild(btn);
                        card.appendChild(hint);
                    }
                    var seg = state.segs[i];
                    if (seg) {
                        seg.blocks.push(card);
                        if (state.active !== i) card.classList.add('mtb-hidden');
                    }
                });
            }

            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'mtb-item' + (i === 0 ? ' active' : '');
            item.setAttribute('role', 'tab');
            item.innerHTML = '<span class="mtb-ico">' + s.icon + '</span><span>' + s.label + '</span>';
            item.addEventListener('click', function () { apply(i); });
            bar.appendChild(item);
        });

        apply(0);
    }

    function boot() {
        if (!document.body || !document.body.classList.contains('mobile-mode')) return;
        TABS.forEach(initTab);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
    // 桌面窄窗口 ↔ 手机来回拖动时补建（initTab 自带防重复）
    window.addEventListener('resize', function () {
        if (document.body && document.body.classList.contains('mobile-mode')) boot();
    });
})();
