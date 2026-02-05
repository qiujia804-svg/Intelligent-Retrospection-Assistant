
// ========================================
// 复盘行动指南弹窗模块
// ========================================

(function() {
    // 指南弹窗相关变量
    let currentSlide = 0;
    const totalSlides = 5;
    let guideModal = null;
    let guideSlider = null;
    let guideDots = null;
    let guideAcknowledge = null;
    let guideConfirmBtn = null;

    // 初始化复盘行动指南
    function initGuideModal() {
        guideModal = document.getElementById('guide-modal');
        if (!guideModal) return;

        guideSlider = document.getElementById('guide-slider');
        guideDots = document.querySelectorAll('.guide-dot');
        guideAcknowledge = document.getElementById('guide-acknowledge');
        guideConfirmBtn = document.getElementById('guide-confirm-btn');

        const guidePrev = document.getElementById('guide-prev');
        const guideNext = document.getElementById('guide-next');

        // 检查用户是否已经看过指南
        const hasSeenGuide = localStorage.getItem('guide_seen');
        if (!hasSeenGuide) {
            // 延迟显示弹窗，让页面先加载完成
            setTimeout(() => {
                showGuideModal();
            }, 1000);
        }

        // 绑定事件
        if (guidePrev) {
            guidePrev.addEventListener('click', prevSlide);
        }
        if (guideNext) {
            guideNext.addEventListener('click', nextSlide);
        }

        // 点击圆点切换
        guideDots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                goToSlide(index);
            });
        });

        // 复选框事件
        if (guideAcknowledge) {
            guideAcknowledge.addEventListener('change', function() {
                guideConfirmBtn.disabled = !this.checked;
            });
        }

        // 确认按钮事件
        if (guideConfirmBtn) {
            guideConfirmBtn.addEventListener('click', function() {
                if (guideAcknowledge.checked) {
                    // 保存到本地存储，标记用户已看过指南
                    localStorage.setItem('guide_seen', 'true');
                    hideGuideModal();
                }
            });
        }

        // 点击遮罩关闭（可选）
        guideModal.addEventListener('click', function(e) {
            if (e.target === guideModal) {
                // 不强制关闭，必须点击确认
            }
        });

        // 键盘导航
        document.addEventListener('keydown', function(e) {
            if (!guideModal.classList.contains('show')) return;

            if (e.key === 'ArrowLeft') {
                prevSlide();
            } else if (e.key === 'ArrowRight') {
                nextSlide();
            }
        });
    }

    // 显示弹窗
    function showGuideModal() {
        if (guideModal) {
            guideModal.classList.add('show');
            document.body.style.overflow = 'hidden'; // 禁止背景滚动
        }
    }

    // 隐藏弹窗
    function hideGuideModal() {
        if (guideModal) {
            guideModal.classList.remove('show');
            document.body.style.overflow = ''; // 恢复背景滚动
        }
    }

    // 切换到指定幻灯片
    function goToSlide(index) {
        if (index < 0 || index >= totalSlides) return;

        currentSlide = index;

        // 更新幻灯片显示
        const slides = document.querySelectorAll('.guide-slide');
        slides.forEach((slide, i) => {
            slide.classList.remove('active');
            if (i === currentSlide) {
                slide.classList.add('active');
            }
        });

        // 更新圆点
        guideDots.forEach((dot, i) => {
            dot.classList.remove('active');
            if (i === currentSlide) {
                dot.classList.add('active');
            }
        });

        // 更新箭头状态
        updateArrowState();
    }

    // 下一张
    function nextSlide() {
        if (currentSlide < totalSlides - 1) {
            goToSlide(currentSlide + 1);
        }
    }

    // 上一张
    function prevSlide() {
        if (currentSlide > 0) {
            goToSlide(currentSlide - 1);
        }
    }

    // 更新箭头状态
    function updateArrowState() {
        const guidePrev = document.getElementById('guide-prev');
        const guideNext = document.getElementById('guide-next');

        if (guidePrev) {
            guidePrev.style.opacity = currentSlide === 0 ? '0.3' : '1';
            guidePrev.style.pointerEvents = currentSlide === 0 ? 'none' : 'auto';
        }
        if (guideNext) {
            guideNext.style.opacity = currentSlide === totalSlides - 1 ? '0.3' : '1';
            guideNext.style.pointerEvents = currentSlide === totalSlides - 1 ? 'none' : 'auto';
        }
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGuideModal);
    } else {
        initGuideModal();
    }

    // 备用初始化
    setTimeout(initGuideModal, 1000);
})();
