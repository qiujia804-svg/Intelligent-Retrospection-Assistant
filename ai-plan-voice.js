(function () {
    'use strict';
    function init() {
        const dialog = document.getElementById('ai-plan-dialog');
        const input = document.getElementById('ai-plan-input');
        const generate = document.getElementById('ai-plan-generate');
        if (!dialog || !input || !generate) return;
        const row = document.createElement('div'); row.className = 'ai-plan-voice';
        const button = document.createElement('button');
        button.type = 'button'; button.id = 'ai-plan-voice-button';
        button.textContent = '🎙 按住说话'; button.setAttribute('aria-pressed', 'false');
        const hint = document.createElement('p'); hint.id = 'ai-plan-voice-status';
        hint.setAttribute('role', 'status'); hint.setAttribute('aria-live', 'polite');
        hint.className = 'ai-plan-hint';
        hint.textContent = '按住说话，松开自动结束，识别文字可修改。首次使用需允许麦克风，语音由浏览器的识别服务处理。';
        row.append(button, hint); input.after(row);
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) {
            button.disabled = true;
            hint.textContent = '当前浏览器暂不支持语音输入，你仍可直接填写计划。';
            return;
        }
        let session = null, heldPointer = null;
        const errors = {
            'not-allowed': '未获得麦克风权限。允许麦克风后可重试，也可直接填写计划。',
            'service-not-allowed': '语音识别服务暂不可用，请稍后重试或直接填写计划。',
            'audio-capture': '未能使用麦克风，请检查麦克风后重试。',
            'no-speech': '没有听到声音，请按住说话再试一次。',
            'network': '语音识别服务连接失败，请稍后重试或直接填写计划。',
            'language-not-supported': '当前语音服务暂不支持中文，请直接填写计划。'
        };
        function finish(s, message) {
            if (session !== s) return;
            clearTimeout(s.timer); clearTimeout(s.stopTimer); session = null; heldPointer = null;
            button.textContent = '🎙 按住说话'; button.setAttribute('aria-pressed', 'false');
            button.disabled = input.disabled; generate.disabled = input.disabled;
            hint.textContent = message || (s.received ? '语音已填入，可修改文字后生成安排。' : '语音输入已结束，未识别到文字。');
        }
        function cancel() {
            const s = session; if (!s) return;
            finish(s, '语音输入已停止，已识别的文字已保留。');
            try { s.recognition.abort(); } catch (e) { /* already stopped */ }
        }
        function stop() {
            const s = session; if (!s || s.stopping) return;
            s.stopping = true; button.disabled = true; hint.textContent = '正在完成识别……';
            try { s.recognition.stop(); } catch (e) { cancel(); return; }
            if (session === s) s.stopTimer = setTimeout(() => { if (session === s) cancel(); }, 10000);
        }
        function start() {
            if (session) return;
            if (input.disabled || generate.disabled) return;
            let instance;
            try { instance = new Recognition(); }
            catch (e) { hint.textContent = '暂时无法启动语音输入，请重试或直接填写计划。'; return; }
            const s = { recognition: instance, received: false, seen: new Set() };
            session = s;
            const recognition = s.recognition;
            recognition.lang = 'zh-CN'; recognition.continuous = true;
            recognition.interimResults = true; recognition.maxAlternatives = 1;
            button.textContent = '🎙 松开结束'; button.setAttribute('aria-pressed', 'true');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            generate.disabled = true; hint.textContent = '正在连接麦克风……';
            recognition.onstart = () => { if (session === s) hint.textContent = '正在聆听，松开即可结束。'; };
            recognition.onresult = event => {
                if (session !== s || !dialog.open || input.disabled) return;
                let interim = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    const text = (result[0]?.transcript || '').trim();
                    if (!result.isFinal) { interim += text; continue; }
                    if (!text || s.seen.has(i)) continue;
                    s.seen.add(i);
                    const separator = input.value && !/\s$/.test(input.value) ? '\n' : '';
                    const limit = input.maxLength > 0 ? input.maxLength : 4000;
                    const addition = (separator + text).slice(0, Math.max(0, limit - input.value.length));
                    input.value += addition; s.received = s.received || Boolean(addition);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    if (input.value.length >= limit) {
                        finish(s, '已达到输入字数上限，请检查文字后生成安排。');
                        try { recognition.abort(); } catch (e) { /* already stopped */ }
                        return;
                    }
                }
                hint.textContent = interim ? '正在识别：' + interim : '正在聆听，已识别的文字会保留在输入框。';
            };
            recognition.onerror = event => {
                if (session !== s) return;
                finish(s, errors[event.error] || '语音输入已中断，已识别的文字已保留，可重试。');
                try { recognition.abort(); } catch (e) { /* already stopped */ }
            };
            recognition.onend = () => finish(s);
            s.timer = setTimeout(stop, 90000);
            try { recognition.start(); }
            catch (e) { finish(s, '暂时无法启动语音输入，请重试或直接填写计划。'); }
        }
        button.addEventListener('pointerdown', event => {
            if (event.button !== 0 || event.isPrimary === false) return;
            event.preventDefault();
            start();
            if (!session) return;
            heldPointer = event.pointerId;
            try { button.setPointerCapture(event.pointerId); } catch (e) { /* release also handled below */ }
        });
        function release(event) {
            if (heldPointer !== event.pointerId) return;
            heldPointer = null; stop();
        }
        window.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', cancel);
        button.addEventListener('lostpointercapture', () => { if (heldPointer !== null) cancel(); });
        button.addEventListener('contextmenu', event => event.preventDefault());
        button.addEventListener('keydown', event => {
            if (event.key !== ' ' && event.key !== 'Enter') return;
            event.preventDefault(); if (!event.repeat) start();
        });
        button.addEventListener('keyup', event => {
            if (event.key !== ' ' && event.key !== 'Enter') return;
            event.preventDefault(); stop();
        });
        button.addEventListener('blur', () => { if (session && heldPointer === null) stop(); });
        dialog.addEventListener('close', cancel);
        document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
        window.addEventListener('pagehide', cancel);
        new MutationObserver(() => { if (!session) button.disabled = input.disabled; })
            .observe(input, { attributes: true, attributeFilter: ['disabled'] });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
