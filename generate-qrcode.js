// 使用node-qrcode库生成二维码
// 首先需要安装库: npm install qrcode
const QRCode = require('qrcode');
const fs = require('fs');

async function generateQRCodes() {
    try {
        // 生成微信支付二维码
        const wechatQR = await QRCode.toString('weixin://wxpay/bizpayurl?pr=example123', {
            type: 'svg',
            color: { dark: '#000000', light: '#ffffff' }
        });
        
        // 生成支付宝支付二维码
        const alipayQR = await QRCode.toString('alipays://platformapi/startapp?appId=20000067&url=example.com', {
            type: 'svg',
            color: { dark: '#00A0E9', light: '#ffffff' }
        });
        
        // 保存到文件
        fs.writeFileSync('images/wechat-qrcode.svg', wechatQR);
        fs.writeFileSync('images/alipay-qrcode.svg', alipayQR);
        
        console.log('二维码生成成功！');
        console.log('微信二维码保存到: images/wechat-qrcode.svg');
        console.log('支付宝二维码保存到: images/alipay-qrcode.svg');
    } catch (err) {
        console.error('生成二维码时出错:', err);
    }
}

generateQRCodes();