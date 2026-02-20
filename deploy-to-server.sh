#!/bin/bash

# ============================================
# 智能复盘助手 - 服务器一键部署脚本
# 使用方法: 在服务器上运行 bash deploy-to-server.sh
# ============================================

set -e  # 遇到错误立即退出

echo "=========================================="
echo "  智能复盘助手 - 服务器部署脚本"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量
PROJECT_DIR="/var/www/deepmind"
SERVER_DIR="$PROJECT_DIR/server"
DOMAIN="deepmind.work"

# 检查是否以 root 运行
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用 root 权限运行此脚本${NC}"
    echo "命令: sudo bash deploy-to-server.sh"
    exit 1
fi

echo -e "${YELLOW}步骤 1/7: 更新系统...${NC}"
apt update && apt upgrade -y
echo -e "${GREEN}✓ 系统更新完成${NC}"
echo ""

echo -e "${YELLOW}步骤 2/7: 安装 Node.js 18.x...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
    echo -e "${GREEN}✓ Node.js 安装完成: $(node -v)${NC}"
else
    echo -e "${GREEN}✓ Node.js 已存在: $(node -v)${NC}"
fi
echo ""

echo -e "${YELLOW}步骤 3/7: 安装 Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    apt install -y nginx
    systemctl start nginx
    systemctl enable nginx
    echo -e "${GREEN}✓ Nginx 安装完成${NC}"
else
    echo -e "${GREEN}✓ Nginx 已存在${NC}"
fi
echo ""

echo -e "${YELLOW}步骤 4/7: 安装 PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    echo -e "${GREEN}✓ PM2 安装完成${NC}"
else
    echo -e "${GREEN}✓ PM2 已存在${NC}"
fi
echo ""

echo -e "${YELLOW}步骤 5/7: 创建项目目录...${NC}"
mkdir -p $PROJECT_DIR
mkdir -p $SERVER_DIR
echo -e "${GREEN}✓ 目录创建完成: $PROJECT_DIR${NC}"
echo ""

echo -e "${YELLOW}步骤 6/7: 配置 Nginx...${NC}"
cat > /etc/nginx/sites-available/deepmind << 'EOF'
server {
    listen 80;
    server_name deepmind.work www.deepmind.work;

    # 前端静态文件
    location / {
        root /var/www/deepmind;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 邮件 API 反向代理
    location /api/send-email {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# 启用配置
if [ -f /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
fi

ln -sf /etc/nginx/sites-available/deepmind /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重启 Nginx
systemctl restart nginx

echo -e "${GREEN}✓ Nginx 配置完成${NC}"
echo ""

echo -e "${YELLOW}步骤 7/7: 启动邮件服务...${NC}"
cd $SERVER_DIR

# 如果邮件服务已经在运行，先停止
pm2 delete email-server 2>/dev/null || true

# 启动邮件服务
pm2 start email-server.js --name "email-server"
pm2 save
pm2 startup systemd -u root --hp /root

echo -e "${GREEN}✓ 邮件服务启动完成${NC}"
echo ""

echo "=========================================="
echo -e "${GREEN}  部署完成！${NC}"
echo "=========================================="
echo ""
echo "项目目录: $PROJECT_DIR"
echo "访问地址: http://$DOMAIN"
echo ""
echo "常用命令:"
echo "  pm2 list              - 查看服务状态"
echo "  pm2 logs email-server - 查看邮件服务日志"
echo "  pm2 restart email-server - 重启邮件服务"
echo "  nginx -t              - 测试 Nginx 配置"
echo "  systemctl restart nginx - 重启 Nginx"
echo ""
echo "下一步（可选）:"
echo "  配置 HTTPS: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
