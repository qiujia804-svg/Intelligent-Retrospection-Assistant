// Keep each quadrant at two task cards, including after AI restore or responsive reflow.
(() => {
    'use strict';
    function init() {
        document.querySelectorAll('#plan-form .quadrant .task-list').forEach(list => {
            let frame;
            const resize = new ResizeObserver(schedule);
            function schedule() {
                cancelAnimationFrame(frame);
                frame = requestAnimationFrame(() => {
                    const cards = [...list.children].filter(e => e.classList.contains('task-item')).slice(0,2);
                    if (!cards.length || !cards[0].offsetHeight) return;
                    const last = cards[cards.length-1];
                    const style = getComputedStyle(list);
                    const height = last.offsetTop-cards[0].offsetTop+last.offsetHeight+
                        parseFloat(style.paddingTop || 0)+parseFloat(style.paddingBottom || 0);
                    list.style.maxHeight = `${Math.ceil(height)}px`;
                });
            }
            function observeCards() {
                resize.disconnect();
                [...list.children].filter(e => e.classList.contains('task-item')).slice(0,2).forEach(e => resize.observe(e));
                schedule();
            }
            list.tabIndex = 0;
            list.setAttribute('role','region');
            list.setAttribute('aria-label',`${list.closest('.quadrant').querySelector('h3').textContent}任务列表，可上下滑动`);
            new MutationObserver(observeCards).observe(list,{childList:true});
            observeCards();
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
