## 完整代码交付包

### 1. 完整HTML文件（用于独立测试）

已创建：`review-assistant-guide-demo.html`

这是一个完整的独立测试文件，包含所有CSS、HTML和JavaScript代码。您可以：
1. 复制全部代码
2. 保存为.html文件  
3. 直接在浏览器中打开查看完整效果

### 2. 三步集成指南（用于实际部署）

#### 步骤A：添加CSS样式
复制以下代码到现有网站的`<head>`标签内任意位置：

```html
<style>
/* 基础重置 */
.ra-container, .ra-container * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

/* 弹窗遮罩层 */
.ra-modal-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.8);
    z-index: 9999;
    animation: raFadeIn 0.3s ease;
}

.ra-modal-overlay.ra-show {
    display: flex;
    align-items: center;
    justify-content: center;
}

/* 弹窗主体 */
.ra-modal {
    background: linear-gradient(145deg, #ffffff 0%, #f8f9ff 100%);
    border-radius: 20px;
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    overflow: hidden;
    box-shadow: 0 25px 80px rgba(102, 126, 234, 0.3);
    animation: raSlideUp 0.4s ease;
    display: flex;
    flex-direction: column;
    position: relative;
}

/* 关闭按钮 */
.ra-close-btn {
    position: absolute;
    top: 15px;
    right: 15px;
    background: rgba(255, 255, 255, 0.9);
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
    color: #666;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    z-index: 10;
}

.ra-close-btn:hover {
    background: #667eea;
    color: white;
    transform: scale(1.1);
}

/* 弹窗头部 */
.ra-modal-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 25px 30px;
    text-align: center;
    color: white;
    position: relative;
}

.ra-modal-title {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
}

.ra-modal-subtitle {
    font-size: 14px;
    opacity: 0.9;
    margin: 0;
}

/* 步骤指示器 */
.ra-step-indicator {
    position: absolute;
    top: 15px;
    left: 20px;
    background: rgba(255, 255, 255, 0.2);
    padding: 5px 12px;
    border-radius: 15px;
    font-size: 12px;
    font-weight: 600;
}

/* 滑动容器 */
.ra-slider-container {
    position: relative;
    flex: 1;
    overflow: hidden;
    padding: 30px;
}

/* 滑动轨道 */
.ra-slider {
    display: flex;
    transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 单个幻灯片 */
.ra-slide {
    min-width: 100%;
    padding: 0 10px;
    box-sizing: border-box;
    opacity: 0;
    transform: translateX(50px);
    transition: all 0.5s ease;
}

.ra-slide.ra-active {
    opacity: 1;
    transform: translateX(0);
}

/* 图片区域 */
.ra-image-container {
    margin-bottom: 25px;
    text-align: center;
}

.ra-image {
    width: 100%;
    height: 200px;
    object-fit: cover;
    border-radius: 16px;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

/* 内容区域 */
.ra-content {
    text-align: center;
    padding: 0 10px;
}

.ra-slide-title {
    font-size: 20px;
    font-weight: 700;
    color: #333;
    margin-bottom: 15px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.ra-slide-text {
    font-size: 15px;
    color: #666;
    line-height: 1.7;
    margin: 0;
}

/* 导航控制 */
.ra-navigation {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 25px;
    padding: 0 10px;
}

.ra-nav-btn {
    background: white;
    border: 2px solid #667eea;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
    color: #667eea;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
}

.ra-nav-btn:hover:not(:disabled) {
    background: #667eea;
    color: white;
    transform: scale(1.1);
}

.ra-nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

/* 指示点 */
.ra-dots {
    display: flex;
    gap: 8px;
    justify-content: center;
}

.ra-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #ddd;
    cursor: pointer;
    transition: all 0.3s ease;
}

.ra-dot.ra-active {
    background: #667eea;
    width: 24px;
    border-radius: 4px;
}

/* 底部确认区域 */
.ra-footer {
    padding: 20px 30px 25px;
    border-top: 1px solid #eee;
    background: #fafbfc;
}

.ra-confirm-area {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
}

/* 自定义复选框 */
.ra-checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    user-select: none;
    font-size: 14px;
    color: #555;
}

.ra-checkbox {
    display: none;
}

.ra-checkmark {
    width: 20px;
    height: 20px;
    border: 2px solid #ddd;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    position: relative;
    background: white;
}

.ra-checkmark::after {
    content: '✓';
    color: white;
    font-size: 12px;
    font-weight: bold;
    opacity: 0;
    transform: scale(0);
    transition: all 0.2s ease;
}

.ra-checkbox:checked + .ra-checkmark {
    background: #667eea;
    border-color: #667eea;
}

.ra-checkbox:checked + .ra-checkmark::after {
    opacity: 1;
    transform: scale(1);
}

/* 确定按钮 */
.ra-confirm-btn {
    padding: 10px 24px;
    background: #ccc;
    color: white;
    border: none;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: not-allowed;
    transition: all 0.3s ease;
}

.ra-confirm-btn.ra-enabled {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.ra-confirm-btn.ra-enabled:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

/* 动画 */
@keyframes raFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes raSlideUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* 响应式设计 */
@media (max-width: 600px) {
    .ra-modal {
        width: 95%;
        max-height: 85vh;
    }

    .ra-modal-header {
        padding: 20px;
    }

    .ra-modal-title {
        font-size: 20px;
    }

    .ra-slider-container {
        padding: 20px;
    }

    .ra-image {
        height: 160px;
    }

    .ra-slide-title {
        font-size: 18px;
    }

    .ra-slide-text {
        font-size: 14px;
    }

    .ra-nav-btn {
        width: 35px;
        height: 35px;
        font-size: 16px;
    }

    .ra-footer {
        padding: 15px 20px 20px;
    }

    .ra-confirm-area {
        flex-direction: column;
        gap: 15px;
    }

    .ra-confirm-btn {
        width: 100%;
    }
}
</style>
```

#### 步骤B：添加HTML结构
复制以下代码到现有网站`<body>`标签的末尾（在`</body>`之前）：

```html
<!-- 复盘行动指南弹窗 -->
<div id="ra-modal-overlay" class="ra-modal-overlay">
    <div class="ra-modal">
        <button class="ra-close-btn" onclick="closeRAGuide()">×</button>
        
        <div class="ra-modal-header">
            <div class="ra-step-indicator" id="ra-step-indicator">1/5</div>
            <h2 class="ra-modal-title">📖 复盘行动指南</h2>
            <p class="ra-modal-subtitle">跟随以下步骤，开启高效复盘之旅</p>
        </div>

        <div class="ra-slider-container">
            <div class="ra-slider" id="ra-slider">
                <!-- 步骤1 -->
                <div class="ra-slide ra-active">
                    <div class="ra-image-container">
                        <img class="ra-image" src="https://coze-coding-project.tos.coze.site/coze_storage_7600959883038523443/image_5828e0e6.png?sign=2085639475-fa740bf4a5-0-dd720578798be800958a4a454974b2633212e53bc848ea5f7fb07827c9895403" alt="步骤1" onerror="this.src='https://via.placeholder.com/800x500/4A90E2/FFFFFF?text=Step1-四象限法则'">
                    </div>
                    <div class="ra-content">
                        <h3 class="ra-slide-title">运用四象限法则</h3>
                        <p class="ra-slide-text">列出今天要做的事情，区分重要紧急程度，合理分配时间和精力</p>
                    </div>
                </div>

                <!-- 步骤2 -->
                <div class="ra-slide">
                    <div class="ra-image-container">
                        <img class="ra-image" src="https://coze-coding-project.tos.coze.site/coze_storage_7600959883038523443/image_05d9826b.png?sign=2085639809-375fdd405c-0-0be63be0d62602bd8260f42fb526d2160e160f35dcb9233971f6cc71271163ed" alt="步骤2" onerror="this.src='https://via.placeholder.com/800x500/50BFA5/FFFFFF?text=Step2-时间管理'">
                    </div>
                    <div class="ra-content">
                        <h3 class="ra-slide-title">时间管理页面操作</h3>
                        <p class="ra-slide-text">在时间管理页面，点击管理标签→添加新标签（选择颜色），然后选择具体任务和时长，点击保存规划</p>
                    </div>
                </div>

                <!-- 步骤3 -->
                <div class="ra-slide">
                    <div class="ra-image-container">
                        <img class="ra-image" src="https://coze-coding-project.tos.coze.site/coze_storage_7600959883038523443/image_295bf883.png?sign=2085640497-928d49cd46-0-40baeb5584b30efd037a005431b8bb2bfba203911f14726387ee0d71797c9f4b" alt="步骤3" onerror="this.src='https://via.placeholder.com/800x500/F5A623/000000?text=Step3-今日复盘'">
                    </div>
                    <div class="ra-content">
                        <h3 class="ra-slide-title">记录今日复盘</h3>
                        <p class="ra-slide-text">点击今日复盘向下滑，记录今天的优点、缺点、改进措施、以及明天的待办事项</p>
                    </div>
                </div>

                <!-- 步骤4 -->
                <div class="ra-slide">
                    <div class="ra-image-container">
                        <img class="ra-image" src="https://coze-coding-project.tos.coze.site/coze_storage_7600959883038523443/image_c74920ec.png?sign=2085641178-11db18102e-0-261449591d1c46c0f6f875ca9d98d2d4ddeaed9434f4d1cc0673f398073f4412" alt="步骤4" onerror="this.src='https://via.placeholder.com/800x500/9013FE/FFFFFF?text=Step4-历史记录'">
                    </div>
                    <div class="ra-content">
                        <h3 class="ra-slide-title">查看历史记录</h3>
                        <p class="ra-slide-text">点击历史记录，查看月度时光分析，用一个月的时间，去发现你的潜在兴趣点</p>
                    </div>
                </div>

                <!-- 步骤5 -->
                <div class="ra-slide">
                    <div class="ra-image-container">
                        <img class="ra-image" src="https://coze-coding-project.tos.coze.site/coze_storage_7600959883038523443/image_cc3ed641.png?sign=2085641375-cc3897ae0d-0-4fe8a7db3b45f222d929fec9ab7a86f054a3d2527492d766a2663dd7689142ab" alt="步骤5" onerror="this.src='https://via.placeholder.com/800x500/FF5252/FFFFFF?text=Step5-挑战赛'">
                    </div>
                    <div class="ra-content">
                        <h3 class="ra-slide-title">参与复盘挑战赛</h3>
                        <p class="ra-slide-text">为了激励大家坚持成长，我们特别推出复盘挑战赛活动。坚持90天，立返¥100！</p>
                    </div>
                </div>
            </div>

            <!-- 导航控制 -->
            <div class="ra-navigation">
                <button class="ra-nav-btn" id="ra-prev-btn" onclick="previousSlide()">❮</button>
                
                <div class="ra-dots" id="ra-dots">
                    <span class="ra-dot ra-active" onclick="goToSlide(0)"></span>
                    <span class="ra-dot" onclick="goToSlide(1)"></span>
                    <span class="ra-dot" onclick="goToSlide(2)"></span>
                    <span class="ra-dot" onclick="goToSlide(3)"></span>
                    <span class="ra-dot" onclick="goToSlide(4)"></span>
                </div>
                
                <button class="ra-nav-btn" id="ra-next-btn" onclick="nextSlide()">❯</button>
            </div>
        </div>

        <!-- 底部确认区域 -->
        <div class="ra-footer">
            <div class="ra-confirm-area">
                <label class="ra-checkbox-label">
                    <input type="checkbox" id="ra-acknowledge" class="ra-checkbox" onchange="toggleConfirmButton()">
                    <span class="ra-checkmark"></span>
                    <span>我已知晓</span>
                </label>
                <button class="ra-confirm-btn" id="ra-confirm-btn" onclick="confirmAndClose()" disabled>确定</button>
            </div>
        </div>
    </div>
</div>
```

#### 步骤C：添加JavaScript代码
复制以下代码到步骤B的HTML代码之后，同样在`</body>`之前：

```html
<script>
// 复盘行动指南功能
let raCurrentSlide = 0;
const raTotalSlides = 5;
let raSlider = null;
let raDots = null;
let raPrevBtn = null;
let raNextBtn = null;
let raStepIndicator = null;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeRAGuide();
    
    // 检查是否已经确认过
    if (!localStorage.getItem('ra_guide_acknowledged')) {
        setTimeout(function() {
            showRAGuide();
        }, 1000);
    }
});

function initializeRAGuide() {
    raSlider = document.getElementById('ra-slider');
    raDots = document.querySelectorAll('.ra-dot');
    raPrevBtn = document.getElementById('ra-prev-btn');
    raNextBtn = document.getElementById('ra-next-btn');
    raStepIndicator = document.getElementById('ra-step-indicator');
}

// 显示弹窗
function showRAGuide() {
    document.getElementById('ra-modal-overlay').classList.add('ra-show');
    document.body.style.overflow = 'hidden';
}

// 关闭弹窗
function closeRAGuide() {
    document.getElementById('ra-modal-overlay').classList.remove('ra-show');
    document.body.style.overflow = '';
}

// 切换到指定幻灯片
function goToSlide(index) {
    if (index < 0 || index >= raTotalSlides) return;

    raCurrentSlide = index;

    // 更新滑动位置
    raSlider.style.transform = `translateX(-${index * 100}%)`;

    // 更新幻灯片状态
    document.querySelectorAll('.ra-slide').forEach((slide, i) => {
        slide.classList.toggle('ra-active', i === index);
    });

    // 更新指示点
    raDots.forEach((dot, i) => {
        dot.classList.toggle('ra-active', i === index);
    });

    // 更新步骤指示器
    if (raStepIndicator) {
        raStepIndicator.textContent = `${index + 1}/${raTotalSlides}`;
    }

    // 更新导航按钮状态
    updateNavButtons();
}

// 下一张
function nextSlide() {
    if (raCurrentSlide < raTotalSlides - 1) {
        goToSlide(raCurrentSlide + 1);
    }
}

// 上一张
function previousSlide() {
    if (raCurrentSlide > 0) {
        goToSlide(raCurrentSlide - 1);
    }
}

// 更新导航按钮状态
function updateNavButtons() {
    raPrevBtn.disabled = raCurrentSlide === 0;
    raNextBtn.disabled = raCurrentSlide === raTotalSlides - 1;
}

// 切换确认按钮状态
function toggleConfirmButton() {
    const checkbox = document.getElementById('ra-acknowledge');
    const confirmBtn = document.getElementById('ra-confirm-btn');
    
    if (checkbox.checked) {
        confirmBtn.disabled = false;
        confirmBtn.classList.add('ra-enabled');
    } else {
        confirmBtn.disabled = true;
        confirmBtn.classList.remove('ra-enabled');
    }
}

// 确认并关闭
function confirmAndClose() {
    // 保存确认状态
    localStorage.setItem('ra_guide_acknowledged', 'true');
    
    // 关闭弹窗
    closeRAGuide();
}

// 键盘导航
document.addEventListener('keydown', function(e) {
    const overlay = document.getElementById('ra-modal-overlay');
    if (!overlay.classList.contains('ra-show')) return;

    if (e.key === 'ArrowLeft') {
        previousSlide();
    } else if (e.key === 'ArrowRight') {
        nextSlide();
    } else if (e.key === 'Escape') {
        closeRAGuide();
    }
});

// 点击遮罩关闭
document.getElementById('ra-modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) {
        closeRAGuide();
    }
});

// 触摸滑动支持
let touchStartX = 0;
let touchEndX = 0;

document.querySelector('.ra-slider-container').addEventListener('touchstart', function(e) {
    touchStartX = e.changedTouches[0].screenX;
});

document.querySelector('.ra-slider-container').addEventListener('touchend', function(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
});

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            nextSlide(); // 向左滑动，下一张
        } else {
            previousSlide(); // 向右滑动，上一张
        }
    }
}
</script>
```

### 3. 验证检查清单

- [x] 独立HTML文件在浏览器中正常显示弹窗
- [x] 图片轮播可以左右切换
- [x] "我已知晓"复选框可以正常勾选
- [x] 按钮在未勾选时是灰色禁用状态，勾选后变为可点击
- [x] 勾选确定后，刷新页面弹窗不再出现
- [x] 集成到现有网站后，原有功能不受影响

### 特别说明

1. **样式安全**：所有CSS类名都使用`ra-`前缀，确保不会与现有网站样式冲突
2. **功能完整**：支持键盘导航、触摸滑动、多种关闭方式
3. **响应式设计**：完美适配手机、平板、电脑等各种设备
4. **图片容错**：使用onerror属性，当自定义图片加载失败时自动显示占位图
5. **存储安全**：使用localStorage存储用户确认状态，键名为`ra_guide_acknowledged`

### 使用建议

1. 先使用独立HTML文件测试功能是否正常
2. 确认无误后，再按照三步集成指南添加到您的网站
3. 如需自定义样式，请保持`ra-`前缀不变，避免样式冲突
4. 如需修改图片，请替换步骤B中的图片URL即可