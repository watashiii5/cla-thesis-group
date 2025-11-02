# For Friends: How to Clone and Run

## 1️⃣ Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/cla-thesis-group.git
cd cla-thesis-group
```

## 2️⃣ Run the Setup Script

### Windows
```bash
scripts\setup.bat
```

### Mac/Linux
```bash
bash scripts/setup.sh
```

## 3️⃣ Start Development

```bash
npm run dev
```

That's it! ✅

### What happens automatically:
- ✅ All npm packages installed
- ✅ All Python dependencies installed
- ✅ Environment files created (if needed)
- ✅ Both frontend and backend started

### Access:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

## ❓ Having Issues?

1. Make sure you have Node.js and Python installed
2. Delete `node_modules` and `backend/venv` (if exists)
3. Run the setup script again
4. Check [SETUP_GUIDE.md](SETUP_GUIDE.md) for troubleshooting

## 🆘 Still Stuck?

Check the error message in the terminal and:
1. Copy the error message
2. Search on Google
3. Ask on StackOverflow
4. Contact the development team

Good luck! 🚀