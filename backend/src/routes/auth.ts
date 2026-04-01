import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import algosdk from 'algosdk';
import User from '../models/User';
import { protect } from '../middleware/auth';

const router = express.Router();

const generateToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'saheli_secret_key_123', {
    expiresIn: '30d',
  });
};

function normalizeWalletAddress(address: string): string {
  return address.trim().toUpperCase();
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, phone, password, role, shgId } = req.body;

    if (!name || !password) {
      res.status(400).json({ success: false, error: 'name and password are required' });
      return;
    }

    if (phone) {
      const userExists = await User.findOne({ phone });
      if (userExists) {
        return res.status(400).json({ success: false, error: 'User already exists with this phone number' });
      }
    }

    const user = await User.create({
      name,
      phone,
      password,
      role: role || 'member',
      shgId
    });

    if (user) {
      res.status(201).json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          phone: user.phone,
          walletAddress: user.walletAddress,
          role: user.role,
          shgId: user.shgId,
          token: generateToken(user._id as unknown as string),
        }
      });
    } else {
      return res.status(400).json({ success: false, error: 'Invalid user data format' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone });

    if (user && (await (user as any).matchPassword(password))) {
      res.json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          phone: user.phone,
          walletAddress: user.walletAddress,
          role: user.role,
          shgId: user.shgId,
          token: generateToken(user._id as unknown as string),
        }
      });
    } else {
      res.status(401).json({ success: false, error: 'Invalid phone number or password' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/pera-login', async (req: Request, res: Response) => {
  try {
    const {
      walletAddress,
      role = 'member',
      name,
      phone,
      shgId,
    } = req.body || {};

    if (!walletAddress || typeof walletAddress !== 'string') {
      res.status(400).json({ success: false, error: 'walletAddress is required' });
      return;
    }

    const normalizedWallet = normalizeWalletAddress(walletAddress);
    if (!algosdk.isValidAddress(normalizedWallet)) {
      res.status(400).json({ success: false, error: 'Invalid Algorand wallet address' });
      return;
    }

    let user = await User.findOne({ walletAddress: normalizedWallet });
    if (!user) {
      user = await User.create({
        name: name || `Pera User ${normalizedWallet.slice(0, 6)}`,
        phone: phone || `pera-${normalizedWallet.slice(0, 10)}`,
        password: uuidv4(),
        role,
        shgId,
        walletAddress: normalizedWallet,
        peraConnectedAt: new Date(),
      });
    } else {
      user.walletAddress = normalizedWallet;
      user.peraConnectedAt = new Date();
      await user.save();
    }

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        walletAddress: user.walletAddress,
        role: user.role,
        shgId: user.shgId,
        token: generateToken(user._id as unknown as string),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Link/Update wallet after login
router.post('/wallet/link', protect, async (req: any, res: Response) => {
  try {
    const { walletAddress } = req.body || {};

    if (!walletAddress || typeof walletAddress !== 'string') {
      res.status(400).json({ success: false, error: 'walletAddress is required' });
      return;
    }

    const normalizedWallet = normalizeWalletAddress(walletAddress);
    if (!algosdk.isValidAddress(normalizedWallet)) {
      res.status(400).json({ success: false, error: 'Invalid Algorand wallet address' });
      return;
    }

    const existingWalletOwner = await User.findOne({ walletAddress: normalizedWallet }).select('_id');
    if (existingWalletOwner && String(existingWalletOwner._id) !== String(req.user._id)) {
      res.status(400).json({ success: false, error: 'Wallet is already linked to another user' });
      return;
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    user.walletAddress = normalizedWallet;
    user.peraConnectedAt = new Date();
    await user.save();

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        walletAddress: user.walletAddress,
        role: user.role,
        shgId: user.shgId,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/profile', protect, async (req: any, res: Response) => {
  const user = await User.findById(req.user._id).select('-password');
  if (user) {
    res.json({ success: true, data: user });
  } else {
    res.status(404).json({ success: false, error: 'User not found' });
  }
});

// ─── Demo Seed (Hackathon only — creates 3 demo users) ─────────────────────
router.post('/seed-demo', async (_req: Request, res: Response) => {
  try {
    const demoUsers = [
      { name: 'Lakshmi Devi', phone: '+91-9876543210', password: 'demo1234', role: 'member', shgId: 'shg1' },
      { name: 'Leader Priya', phone: '+91-9000000001', password: 'demo1234', role: 'leader', shgId: 'shg1' },
      { name: 'Bank Manager',  phone: '+91-9000000002', password: 'demo1234', role: 'bank' },
    ];
    const results = [];
    for (const u of demoUsers) {
      const exists = await User.findOne({ phone: u.phone });
      if (!exists) {
        const created = await User.create(u);
        results.push({ created: true, phone: created.phone, role: created.role });
      } else {
        results.push({ created: false, phone: u.phone, role: u.role, note: 'already exists' });
      }
    }
    res.json({ success: true, data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
