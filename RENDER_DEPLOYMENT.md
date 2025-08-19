# 🚀 ZhiLog Render部署指南

## 📋 部署前准备

### 1. 必需账户和API密钥
- [ ] Render账户 (https://render.com)
- [ ] OpenAI API密钥
- [ ] Google AI API密钥 (可选)
- [ ] GitHub仓库 (包含此项目)

### 2. 项目文件检查
确保以下文件已创建：
- ✅ `render.yaml` - Render服务配置
- ✅ `server/requirements-render.txt` - 后端依赖
- ✅ `server/start-render.sh` - 后端启动脚本
- ✅ `jobs/start-celery-render.sh` - Celery Worker启动脚本
- ✅ `jobs/start-celery-api-render.sh` - Celery API启动脚本
- ✅ `client/next.config.ts` - 前端配置更新

## 🚀 部署步骤

### 第一步：连接GitHub仓库

1. 登录 [Render控制台](https://dashboard.render.com)
2. 点击 "New +" → "Blueprint"
3. 连接您的GitHub账户
4. 选择包含此项目的仓库
5. 点击 "Connect"

### 第二步：配置Blueprint

1. Render会自动检测 `render.yaml` 文件
2. 确认服务配置：
   - **zhilog-backend**: 后端API服务
   - **zhilog-frontend**: 前端服务
   - **zhilog-celery**: Celery Worker
   - **zhilog-celery-api**: Celery API服务
   - **zhilog-db**: PostgreSQL数据库
   - **zhilog-redis**: Redis缓存

3. 点击 "Apply"

### 第三步：设置环境变量

在Render控制台中为每个服务设置环境变量：

#### 后端服务 (zhilog-backend)
```env
OPENAI_API_KEY=your_openai_api_key
GOOGLE_AI_API_KEY=your_google_ai_key
AWS_ACCESS_KEY_ID=your_aws_key (可选)
AWS_SECRET_ACCESS_KEY=your_aws_secret (可选)
STRIPE_SECRET_KEY=your_stripe_key (可选)
```

#### 前端服务 (zhilog-frontend)
```env
NEXT_PUBLIC_API_URL=https://zhilog-backend.onrender.com
NEXT_PUBLIC_CELERY_API_URL=https://zhilog-celery-api.onrender.com
```

#### Celery服务
```env
OPENAI_API_KEY=your_openai_api_key
GOOGLE_AI_API_KEY=your_google_ai_key
```

### 第四步：等待部署完成

1. Render会自动开始构建和部署
2. 构建过程可能需要5-10分钟
3. 查看构建日志确保没有错误

### 第五步：验证部署

1. **检查服务状态**
   - 所有服务应该显示 "Live" 状态
   - 健康检查应该通过

2. **测试API端点**
   ```bash
   # 测试后端健康检查
   curl https://zhilog-backend.onrender.com/api/health
   
   # 测试Celery API
   curl https://zhilog-celery-api.onrender.com/health
   ```

3. **访问前端**
   - 打开 https://zhilog-frontend.onrender.com
   - 测试基本功能

## 🔧 故障排除

### 常见问题

#### 1. 构建失败
**问题**: 依赖安装失败
**解决**: 检查 `requirements-render.txt` 文件，确保所有依赖版本兼容

#### 2. 数据库连接失败
**问题**: 数据库迁移失败
**解决**: 检查 `DATABASE_URL` 环境变量，确保数据库服务已启动

#### 3. Redis连接失败
**问题**: Celery无法连接Redis
**解决**: 检查 `REDIS_URL` 环境变量，确保Redis服务已启动

#### 4. 前端API调用失败
**问题**: 前端无法调用后端API
**解决**: 检查 `NEXT_PUBLIC_API_URL` 环境变量，确保URL正确

### 日志查看

在Render控制台中查看服务日志：
1. 点击服务名称
2. 点击 "Logs" 标签
3. 查看实时日志输出

## 📊 监控和维护

### 1. 服务监控
- 定期检查服务状态
- 监控资源使用情况
- 查看错误日志

### 2. 性能优化
- 启用缓存策略
- 优化数据库查询
- 监控API响应时间

### 3. 备份策略
- 定期备份数据库
- 备份重要配置文件
- 测试恢复流程

## 💰 成本估算

### 免费计划限制
- **服务时间**: 750小时/月
- **数据库**: 1GB存储
- **Redis**: 100MB存储
- **带宽**: 100GB/月

### 升级建议
如果免费计划不够用，考虑升级到付费计划：
- **Starter**: $7/月
- **Standard**: $25/月
- **Pro**: $100/月

## 🔗 自定义域名

### 设置步骤
1. 在Render控制台中点击服务
2. 点击 "Settings" → "Custom Domains"
3. 添加您的域名
4. 配置DNS记录指向Render提供的CNAME

### SSL证书
Render自动为所有服务提供SSL证书，无需额外配置。

## 📞 支持

如果遇到问题：
1. 查看Render官方文档
2. 检查服务日志
3. 联系Render支持团队

---

**部署完成后，您的ZhiLog应用将在以下地址运行：**
- 前端: https://zhilog-frontend.onrender.com
- 后端API: https://zhilog-backend.onrender.com
- Celery API: https://zhilog-celery-api.onrender.com 