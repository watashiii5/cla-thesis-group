# CLA Thesis Group - Complete Setup Guide

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.0.0 or higher) - [Download here](https://nodejs.org/)
- **Python** (v3.10 or higher) - [Download here](https://www.python.org/)
- **Git** (latest version) - [Download here](https://git-scm.com/)
- **Text Editor** - VS Code recommended ([Download here](https://code.visualstudio.com/))

### Verify Installation

Open your terminal/command prompt and run:

```bash
node --version   # Should show v18.0.0 or higher
python --version # Should show 3.10.0 or higher
git --version    # Should show git version
npm --version    # Should show 9.0.0 or higher
```

## 🚀 Quick Start (Recommended)

### Windows Users
```bash
cd cla-thesis-group
scripts\setup.bat
npm run dev
```

### Mac/Linux Users
```bash
cd cla-thesis-group
chmod +x scripts/setup.sh
bash scripts/setup.sh
npm run dev
```

---

## 📦 Manual Setup (If Scripts Don't Work)

### Step 1: Install Frontend Dependencies
```bash
npm install
```

### Step 2: Install Backend Dependencies
```bash
cd backend
pip install -r requirements.txt
cd ..
```

### Step 3: Configure Environment Variables

**Frontend** (`.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://yuayzoouloznokcgeunb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here
SUPABASE_SERVICE_ROLE_KEY=your_key_here
BACKEND_BASE_URL=http://127.0.0.1:8000
```

**Backend** (`backend/.env`):
```env
SUPABASE_URL=https://yuayzoouloznokcgeunb.supabase.co
SUPABASE_KEY=your_key_here
```

### Step 4: Run Development Server
```bash
npm run dev
```

---

## 🌐 Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

---

## 🛠️ Available Commands

```bash
# Start both frontend and backend
npm run dev

# Start only frontend
npm run dev:frontend

# Start only backend
npm run dev:backend

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Type checking
npm run type-check
```

---

## ⚠️ Troubleshooting

### Error: "ModuleNotFoundError: No module named 'fastapi'"
```bash
cd backend
pip install -r requirements.txt
cd ..
```

### Error: "Cannot find module 'next'"
```bash
npm install
```

### Port 3000 or 8000 Already in Use
The app will automatically use the next available port.

### Permission Denied (Mac/Linux)
```bash
chmod +x scripts/setup.sh
bash scripts/setup.sh
```

---

## 📚 Project Structure

```
cla-thesis-group/
├── src/                          # Frontend (Next.js)
│   ├── app/                      # Next.js app router
│   ├── components/               # React components
│   ├── LandingPages/             # Page components
│   ├── api/                      # API routes
│   └── lib/                      # Utilities
├── backend/                      # Backend (FastAPI)
│   ├── api/                      # API modules
│   ├── main.py                   # Entry point
│   ├── requirements.txt          # Python dependencies
│   └── .env                      # Backend config
├── scripts/                      # Setup scripts
├── public/                       # Static assets
├── package.json                  # Frontend dependencies
└── next.config.js                # Next.js config
```

---

## 🔐 Security Notes

1. **Never commit `.env` files** - They're in `.gitignore`
2. **Keep API keys private** - Use environment variables
3. **Service Role Key** - Only use server-side (backend)
4. **Anon Key** - Safe to use in frontend with RLS protection

---

## 📞 Support

For issues:
1. Check this guide first
2. Check error logs in terminal
3. Verify all prerequisites are installed
4. Run setup scripts again

Good luck! 🎉