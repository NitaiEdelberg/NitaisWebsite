import bcrypt from 'bcryptjs'; // bcrypt library for hashing passwords
import jwt from 'jsonwebtoken'; // jwt library for creating tokens
import User from '../models/user.model.js';


export const registerUser = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: "Missing fields" });
  
    try {
      const existing = await User.findOne({ email });
      if (existing)
        return res.status(400).json({ success: false, message: "email already taken" });
  
      const passwordHash = await bcrypt.hash(password, 10);
      const user = new User({ email, passwordHash });
      await user.save();
      res.status(201).json({ success: true, message: "User registered" });
    } catch (err) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  };


  export const loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });
  
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ success: false, message: "Invalid credentials" });
  
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      res.status(200).json({ success: true, token });
    } catch (err) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  };