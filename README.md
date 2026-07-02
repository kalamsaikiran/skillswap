# 🚀 SkillSwap

**SkillSwap** is a Full Stack Skill Exchange Platform that enables users to connect with others to teach and learn new skills. Users can create profiles, showcase the skills they can teach, discover people with complementary skills, communicate through real-time chat, and build meaningful learning connections.

---

## 📌 Features

- 🔐 User Authentication (Sign Up / Login)
- 👤 User Profile Management
- 🎯 Add Skills You Can Teach
- 📚 Add Skills You Want to Learn
- 🔍 Browse Users by Skills
- 🤝 Connect with Other Users
- 💬 Real-Time Chat using Socket.io
- ⭐ Rating & Review System
- 📱 Responsive User Interface
- 🌙 Modern Dashboard

---

## 🛠️ Tech Stack

### Frontend
- React.js
- Tailwind CSS
- React Router
- Axios

### Backend
- Node.js
- Express.js
- Socket.io

### Database
- MongoDB Atlas
- Mongoose

### Authentication
- JWT (JSON Web Token)
- bcrypt

---

## 📂 Project Structure

```
SkillSwap/
│
├── client/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── server/
│   ├── controllers/
│   ├── routes/
│   ├── models/
│   ├── middleware/
│   ├── sockets/
│   ├── config/
│   └── server.js
│
├── README.md
└── package.json
```

---

## ⚙️ Installation

### Clone Repository

```bash
git clone https://github.com/kalamsaikiran/SkillSwap.git
```

### Navigate to Project

```bash
cd SkillSwap
```

### Install Frontend

```bash
cd client
npm install
```

### Install Backend

```bash
cd ../server
npm install
```

---

## ▶️ Run the Application

### Start Backend

```bash
npm run dev
```

### Start Frontend

```bash
cd client
npm run dev
```

---

## 🔑 Environment Variables

Create a `.env` file inside the **server** folder.

```env
PORT=5000

MONGO_URI=your_mongodb_connection_string

JWT_SECRET=your_secret_key

CLIENT_URL=http://localhost:5173
```

---

## 📸 Screenshots

### Home Page

```
Add Screenshot Here
```

### Dashboard

```
Add Screenshot Here
```

### Profile

```
Add Screenshot Here
```

### Chat

```
Add Screenshot Here
```

---

## 🔄 Workflow

1. Register or Login
2. Create Your Profile
3. Add Skills You Can Teach
4. Add Skills You Want to Learn
5. Discover Matching Users
6. Send Connection Request
7. Start Chatting
8. Exchange Skills
9. Give Ratings & Reviews

---

## 📡 API Overview

### Authentication

```
POST /api/auth/register

POST /api/auth/login
```

### Users

```
GET /api/users

GET /api/users/:id

PUT /api/users/profile
```

### Connections

```
POST /api/connections/request

GET /api/connections

PUT /api/connections/:id
```

### Messages

```
GET /api/messages/:conversationId

POST /api/messages
```

---

## 📈 Future Enhancements

- 📧 Email Verification
- 🔔 Real-Time Notifications
- 🎥 Video Calling
- 📅 Meeting Scheduling
- 📁 File Sharing
- 🌐 Multi-language Support
- 📊 User Analytics Dashboard
- 📱 Mobile Application
- 🏆 Achievement Badges

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a new branch

```bash
git checkout -b feature-name
```

3. Commit your changes

```bash
git commit -m "Add new feature"
```

4. Push to GitHub

```bash
git push origin feature-name
```

5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License**.

---

## 👨‍💻 Author

**Sai Kiran Reddy**

- GitHub: https://github.com/kalamsaikiran
- LinkedIn: *(Add your LinkedIn URL)*
- Email: *(Add your Email)*

---

## ⭐ Support

If you like this project, consider giving it a **⭐ Star** on GitHub. It helps the project reach more developers and motivates further improvements.

---

## 💡 Why SkillSwap?

Learning is more effective when knowledge is shared. SkillSwap bridges the gap between learners and mentors by providing a collaborative platform where users can exchange skills, communicate seamlessly, and grow together.
