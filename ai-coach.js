/* ============================================================
   ai-coach.js — AI复盘教练（2026-10-13）
   挂载在「智能建议」tab（#advice-content）：把原来的静态
   「生成建议」界面升级为对话式智能体——教练头衔卡 + 消息流 +
   快捷指令 + 输入框，桌面端与手机端均生效。
   - 不改动「AI帮我复盘」按钮及其任何逻辑（ai-review.js 原样）。
   - 真实对话走 /api/ai-coach（会员鉴权 + 试用额度在服务端处理）。
   ============================================================ */
(function () {
    'use strict';

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function todayStr() {
        var now = new Date();
        return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    }

    // ---- 收集当天数据（结构与 ai-review.js 的 collect 一致，供服务端注入教练上下文）----
    function collect() {
        var date = todayStr();
        try { if (typeof updateTimeStatistics === 'function') updateTimeStatistics(); } catch (e) { /* 统计刷新失败不阻断 */ }
        var schedule = Array.prototype.map.call(document.querySelectorAll('#schedule-items .schedule-item'), function (r) {
            function g(sel) { var el = r.querySelector(sel); return el ? el.value : ''; }
            return { time: g('.time-select'), task: String(g('.task-input')).trim(), minutes: parseInt(g('.duration-input'), 10) || 0 };
        }).filter(function (x) { return x.time && x.task && x.minutes > 0; });

        var plan = null;
        try {
            var plans = JSON.parse(localStorage.getItem('smart_review_assistant_plans') || '[]');
            plan = (Array.isArray(plans) ? plans : []).find(function (p) { return p && p.date === date; }) || null;
        } catch (e) { plan = null; }

        var lastReview = null;
        try {
            var reviews = typeof getReviews === 'function' ? getReviews()
                : JSON.parse(localStorage.getItem('smart_review_assistant_reviews') || '[]');
            var list = (Array.isArray(reviews) ? reviews : [])
                .filter(function (r) { return r && r.date && r.date < date; })
                .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
            var found = list.find(function (r) { return (r.todos && String(r.todos).trim()) || (r.improvements && String(r.improvements).trim()); });
            if (found) lastReview = { date: found.date, todos: found.todos || '', improvements: found.improvements || '' };
        } catch (e) { lastReview = null; }

        var stats = typeof getCurrentTimeStats === 'function' ? getCurrentTimeStats() : null;
        var gp = document.getElementById('goal-progress');
        var gc = document.getElementById('goal-completion');
        return {
            date: date, plan: plan, schedule: schedule, currentStats: stats, lastReview: lastReview,
            goalCompletion: { percentage: gp ? Number(gp.value) : NaN, description: gc ? gc.value : '' }
        };
    }

    var DEFAULT_REPLIES = ['📊 帮我分析今天', '🔥 我坚持不下去了', '🎯 明天怎么规划更好？'];

    var WELCOME = '你好，我是你的 AI 复盘教练 👋\n我会根据你今天的规划和时间安排，陪你复盘、帮你坚持。\n\n可以直接输入，也可以点下面的快捷指令开始。';

    function boot() {
        var mount = document.getElementById('ai-coach-mount');
        if (!mount || mount.dataset.coachReady === '1') return;
        mount.dataset.coachReady = '1';

        var card = document.createElement('div');
        card.id = 'ai-coach-card';
        card.className = 'ai-coach';
        card.innerHTML =
            // 顶部教练信息栏（小程序 AI 教练同款：头像 + 头衔 + 标签）
            '<div class="ac-header">' +
                '<div class="ac-avatar"><span class="ac-avatar-icon">🧠</span><span class="ac-status"><i></i>在线</span></div>' +
                '<div class="ac-info">' +
                    '<div class="ac-name">AI复盘教练</div>' +
                    '<div class="ac-title">陪你复盘 · 助你成长</div>' +
                    '<div class="ac-tags"><span>目标导向</span><span>数据驱动</span><span>成长思维</span></div>' +
                '</div>' +
            '</div>' +
            // 消息流
            '<div class="ac-msgs" id="ac-msgs"></div>' +
            // 快捷指令
            '<div class="ac-actions">' +
                '<button type="button" class="ac-act" data-act="analyze"><span>📊</span>帮我分析今天</button>' +
                '<button type="button" class="ac-act" data-act="stuck"><span>🔥</span>我坚持不下去了</button>' +
                '<button type="button" class="ac-act" data-act="plan"><span>🎯</span>明天怎么规划更好？</button>' +
            '</div>' +
            // 输入区
            '<div class="ac-input-wrap">' +
                '<input type="text" class="ac-input" id="ac-input" placeholder="和教练聊聊今天的复盘…" maxlength="2000">' +
                '<button type="button" class="ac-send" id="ac-send" aria-label="发送">➤</button>' +
            '</div>';

            mount.appendChild(card);

            var msgs = card.querySelector('#ac-msgs');
            var input = card.querySelector('#ac-input');
            var sendBtn = card.querySelector('#ac-send');
            var history = []; // {role, content} 仅本次会话内存
            var sending = false;

            function addMsg(type, text, quickReplies) {
                var wrap = document.createElement('div');
                wrap.className = 'ac-row ' + type;
                var avatar = type === 'coach' ? '<div class="ac-ma">🧠</div>' : '';
                var bubble = '<div class="ac-bubble ' + (type === 'user' ? 'ac-bu' : 'ac-bc') + '">' + esc(text) + '</div>';
                wrap.innerHTML = type === 'coach' ? avatar + '<div class="ac-mc">' + bubble + (quickReplies && quickReplies.length ? '<div class="ac-qr">' + quickReplies.map(function (q) { return '<button type="button" class="ac-reply" data-text="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') + '</div>' : '') + '</div>' : bubble;
                msgs.appendChild(wrap);
                msgs.scrollTop = msgs.scrollHeight;
                return wrap;
            }

            function addTyping() {
                var wrap = document.createElement('div');
                wrap.className = 'ac-row coach';
                wrap.innerHTML = '<div class="ac-ma">🧠</div><div class="ac-mc"><div class="ac-bubble ac-bc ac-typing"><i></i><i></i><i></i></div></div>';
                msgs.appendChild(wrap);
                msgs.scrollTop = msgs.scrollHeight;
                return wrap;
            }

            async function callCoach() {
                var controller = new AbortController();
                var timer = setTimeout(function () { controller.abort(); }, 60000);
                try {
                    var authHeader = (window.CloudMember && typeof window.CloudMember.getAuthHeader === 'function')
                        ? await window.CloudMember.getAuthHeader() : {};
                    var response = await fetch('/api/ai-coach', {
                        method: 'POST',
                        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader),
                        signal: controller.signal,
                        body: JSON.stringify({ input: collect(), messages: history.slice(-20) })
                    });
                    var data = await response.json().catch(function () { throw new Error('AI接口不可用，请稍后重试。'); });
                    if (!response.ok) {
                        if (response.status === 401) throw new Error('请先登录后再和教练对话。');
                        if (response.status === 403) {
                            if (typeof openVipCenter === 'function') { try { openVipCenter(); } catch (e) { /* 忽略 */ } }
                            throw new Error(data.error || 'AI 教练属于会员权益，请先开通会员。');
                        }
                        throw new Error(data.error || '教练暂时掉线了，请重试。');
                    }
                    if (!data || typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('教练暂时没有回话，请重试。');
                    return data.reply.trim();
                } finally { clearTimeout(timer); }
            }

            async function send(text) {
                text = String(text || '').trim();
                if (!text || sending) return;
                sending = true;
                sendBtn.classList.add('busy');
                addMsg('user', text);
                history.push({ role: 'user', content: text });
                var tip = addTyping();
                try {
                    var reply = await callCoach();
                    history.push({ role: 'assistant', content: reply });
                    tip.remove();
                    addMsg('coach', reply, DEFAULT_REPLIES);
                } catch (e) {
                    tip.remove();
                    addMsg('coach', (e && e.name === 'AbortError') ? '教练思考超时了，请重新发送一次。' : (e.message || '教练暂时掉线了，请重试。'));
                } finally {
                    sending = false;
                    sendBtn.classList.remove('busy');
                }
            }

            card.addEventListener('click', function (ev) {
                var act = ev.target.closest('.ac-act');
                if (act) {
                    var map = {
                        analyze: '结合我今天的规划和时间安排，帮我分析一下完成情况和时间分配，给一个明天就能做的小建议。',
                        stuck: '我最近复盘总是坚持不下去，找到兴趣点后又很难持续，怎么办？',
                        plan: '根据我今天的复盘情况，明天的时间应该怎么规划更好？'
                    };
                    var t = map[act.getAttribute('data-act')];
                    if (t) send(t);
                    return;
                }
                var reply = ev.target.closest('.ac-reply');
                if (reply) send(reply.getAttribute('data-text'));
            });

            sendBtn.addEventListener('click', function () { send(input.value); input.value = ''; });
            input.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter') { ev.preventDefault(); send(input.value); input.value = ''; }
            });

            addMsg('coach', WELCOME, DEFAULT_REPLIES);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
