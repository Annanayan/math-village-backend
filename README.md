# Math Village - Backend API

Math Village后端API服务

## 部署到 Render

1. 推送到 GitHub 仓库
2. 在 Render 创建新的 Web Service
3. 连接 GitHub 仓库
4. 配置：
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
5. 配置环境变量：
   - `OPENAI_API_KEY`: OpenAI API密钥
   - `JWT_SECRET`: JWT密钥
   - `TEACHER_KEY`: 教师访问密钥

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
npm start
```

## 环境变量

创建 `.env` 文件：
```
OPENAI_API_KEY=your_openai_api_key
JWT_SECRET=your_jwt_secret_key
TEACHER_KEY=teacher-secret-key-2024
PORT=3000
```