import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import { verifyTransaction, executeOnChainRecord } from '../services/txEngine';
import { sendQRCodeWhatsAppReceipt } from '../services/whatsapp';
import mongoose from 'mongoose';
import User from '../models/User';
import { protect } from '../middleware/auth';

const router = Router();

// POST /api/qr/generate
router.post('/generate', protect, async (req: Request, res: Response) => {
  try {
    const {
      transactionId,
      memberId,
      memberName,
      memberPhone,
      amount,
      type,
      autoSendWhatsApp = true,
    } = req.body;

    let resolvedMemberName = memberName;
    let resolvedPhone = memberPhone;
    let resolvedMemberWalletAddress: string | null | undefined;
    let hash = transactionId;

    if ((!resolvedMemberName || !resolvedPhone) && memberId && mongoose.Types.ObjectId.isValid(memberId)) {
      const member = await User.findById(memberId).select('name phone role walletAddress').lean();
      if (member && member.role === 'member') {
        resolvedMemberName = resolvedMemberName || member.name;
        resolvedPhone = resolvedPhone || member.phone;
        resolvedMemberWalletAddress = member.walletAddress;
      }
    }

    if (!hash) {
      const chain = await executeOnChainRecord({
        type: 'qr_anchor',
        amount: Number(amount || 0),
        description: `QR proof anchor for ${type || 'deposit'}`,
        memberId,
        memberName: resolvedMemberName,
        memberWalletAddress: resolvedMemberWalletAddress,
        recipientWalletAddress: resolvedMemberWalletAddress,
        metadata: {
          source: 'qr.generate',
          qrType: type || 'deposit',
        },
        forceValueTransfer: false,
      });
      hash = chain.transactionId;
    }

    const qrPayload = JSON.stringify({
      platform: 'Saheli',
      transactionId: hash,
      memberId: memberId || undefined,
      memberName: resolvedMemberName || 'Member',
      amount,
      type: type || 'deposit',
      verified: true,
      verifyUrl: `/api/qr/verify/${hash}`,
      timestamp: new Date().toISOString(),
    });

    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 2,
      color: {
        dark: '#191C1D',
        light: '#FFFFFF',
      },
    });

    const targetPhone = resolvedPhone;

    let whatsapp: {
      attempted: boolean;
      sent: boolean;
      messageSid?: string;
      mediaUrl?: string;
      status?: string;
      error?: string;
    } = {
      attempted: false,
      sent: false,
    };

    if (autoSendWhatsApp && targetPhone) {
      whatsapp.attempted = true;
      try {
        const delivery = await sendQRCodeWhatsAppReceipt({
          toPhone: targetPhone,
          memberName: resolvedMemberName || 'Member',
          transactionId: hash,
          explorerUrl: `/api/qr/verify/${hash}`,
          qrDataUrl,
        });
        whatsapp = {
          attempted: true,
          sent: true,
          messageSid: delivery.messageSid,
          mediaUrl: delivery.mediaUrl,
          status: delivery.twilioStatus,
        };
      } catch (error) {
        const errMessage = error instanceof Error ? error.message : 'Failed to send WhatsApp message';
        whatsapp = {
          attempted: true,
          sent: false,
          error: errMessage,
        };
      }
    }

    res.json({
      success: true,
      data: {
        transactionId: hash,
        qrCode: qrDataUrl,
        payload: JSON.parse(qrPayload),
        whatsapp,
        message: whatsapp.sent
          ? 'QR proof generated and sent to member on WhatsApp.'
          : 'QR proof generated. Share this with any bank officer to verify.',
      },
    });
  } catch (_err) {
    res.status(500).json({ success: false, error: 'QR generation failed' });
  }
});

// GET /api/qr/verify/:transactionId
router.get('/verify/:transactionId', async (req: Request, res: Response) => {
  const { transactionId } = req.params;
  const result = await verifyTransaction(transactionId);

  res.json({
    success: true,
    data: {
      transactionId,
      ...result,
      message: result.valid
        ? 'Transaction verified successfully'
        : 'Transaction not found',
    },
  });
});

export default router;
